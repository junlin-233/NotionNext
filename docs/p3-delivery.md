# P3 交付说明（内容管线）

> 更新日期：2026-11-02 ｜ 对应计划：`UPGRADE_PLAN.md` 第六节

---

## 一、设计决策：存原始 recordMap，不存转换后的数据

`normalizeNotionMetadata` / `adapterNotionBlockMap` / `getPageProperties` 这一整套转换在
`lib/db/notion/` 里，依赖 TS 与 `@/` 别名，只能在 Next 运行时里跑。脚本侧复制一份必然漂移。

所以同步器只做三件事：拉原始数据、下载图片、写文件。转换仍然由站点运行时那一套代码做，
`GitDataApi` 和 `SiteDataApi` 的产出天然一致，不存在「两边渲染不一样」的问题。

Markdown 是另一条支线，只服务 Pagefind 索引、RAG 切段和 git diff，不参与渲染。

---

## 二、同步器（计划 6.1）

| 文件 | 职责 |
|---|---|
| `scripts/sync-notion.js` | 主流程：拉站点 recordMap → 补齐行 block → 逐篇拉正文 → 本地化图片 → 写 `content/` |
| `scripts/lib/notion-images.cjs` | 图片地址归一化（去签名）、收集、回填、下载地址解析（`attachment:` / S3 裸链 / 已有签名链） |
| `scripts/lib/notion-markdown.cjs` | recordMap → Markdown，覆盖段落/标题/列表/待办/引用/代码/公式/图片/书签/表格/分栏 |

产物结构：

```
content/
  index.json          # id → 文件、slug、url、lastEditedTime、图片 key → 本地路径
  sites/<siteId>.json # 站点数据库页的原始 recordMap（多语言各一份）
  pages/<file>.json   # 单篇正文的原始 recordMap（图片已替换为 /images/notion/xxx）
  pages/<file>.md     # 同名 markdown，带 title/slug/url/notionId 前置信息
public/images/notion/ # 落地图片，文件名 = 去签名地址的 sha1 前 20 位 + 扩展名
```

几个关键处理：

- **增量**：按行 block 的 `last_edited_time` 判断，未变更的文章不重写，git diff 干净；`--force` 全量。
- **图片幂等**：Notion 的 S3 地址每次带不同签名，文件名基于「去掉 `X-Amz-*` / `expiration_time` 等参数后的地址」做 hash，不然后每天同步都会新增一堆重复文件。
- **下载地址解析**：`attachment:` 走 `/signed/` 换签名链；`prod-files-secure` / `secure.notion-static.com` 裸链直连必 403，改走 `/image/?table=block&id=...` 让 Notion 现签。
- **限流**：Notion 对连续 `loadPageChunk` 会 429/403。每篇间隔 2.5s（`--interval` 可调），429/5xx 指数退避重试，403 直接放弃并保留原有内容。
- **文件名唯一**：标题会重复（模板文章、空标题），冲突时补 id 前缀；已存在的文件名优先沿用，避免每跑一次就改一次名。
- **行 block 补齐**：数据库行多时 Notion 只返回一部分 block，缺失的在同步阶段用 `getBlocks` 批量补，避免运行时回源。

用法：

```bash
npm run sync:content                    # 增量
node scripts/sync-notion.js --force     # 全量
node scripts/sync-notion.js --limit=3   # 调试
node scripts/sync-notion.js --no-images # 只同步文本
```

---

## 三、自动化（计划 6.2）

`.github/workflows/sync-notion.yml`：每 6 小时 + 手动触发；只在 `content/` 或 `public/images/notion/` 有变化时 commit；
同步完跑一次 md 模式搜索索引；失败只报红，不影响线上（站点读上一次提交的内容）。

同步作业只装 `notion-client` 一个依赖（`npm install notion-client@7.10.0 --no-save`），十几秒起跑，不必装全量依赖。

---

## 四、站点读取切换（计划 6.3）

| 文件 | 变更 |
|---|---|
| `lib/db/git/loader.js` | 新增：读 `content/`，把站点 recordMap 与各篇文章的行 block 合并后返回 |
| `lib/db/SiteDataApi.js` | 三个取数点改为 `loadSiteRecordMap` / `loadPageRecordMap`，内部按 `CONTENT_SOURCE` 分派；git 模式下跳过「UUID slug 回源 Notion」的兜底 |
| `lib/db/GitDataApi.js` | 新增：与 `SiteDataApi` 同签名的入口（`fetchGlobalAllData` / `resolvePostProps` / `getPostBlocks`），新代码从这里进 |
| `blog.config.js` | 新增 `CONTENT_SOURCE`（`notion` / `git`，默认 `notion`）；git 模式下 `NEXT_REVALIDATE_SECOND` 默认从 600 提到 3600 |
| `pages/api/status.js` | 输出 `contentSource` / `content`（篇数、同步时间）/ `knowledge`（向量是否就绪） |

为什么分派放在 `SiteDataApi` 里而不是改 24 个页面：切源只改一个环境变量，回滚也是一行，不用碰页面代码。
`GitDataApi` 保留同名导出，语义上仍是「git 数据源入口」。

切换步骤：

```bash
# 1) 先跑同步，确认 content/ 完整
npm run sync:content

# 2) 对比两侧产出：notion 模式构建一次，记下文章数与首页列表
npm run build

# 3) 切 git 模式再构建，对比首页、任取 3 篇文章的正文与图片
CONTENT_SOURCE=git npm run build

# 4) 线上配 CONTENT_SOURCE=git 部署；出问题删掉这个变量即回退
```

---

## 五、搜索索引源（计划 6.4）

`scripts/build-search-index.js` 增加 `--source=md`：

- 读 `content/index.json` + `pages/<file>.md`，按文章 `url` 生成 HTML stub，交给 Pagefind 索引，秒级完成；
- 默认仍是爬取模式（`--source=crawl`），覆盖标签/分类/归档页，URL 一定与线上一致；
- md 模式只索引正文，标签/分类页不进索引 —— 这是取舍，不是缺陷，切换后需要标签页搜索就继续用爬取模式。

---

## 六、收尾（计划 6.5）

- git 模式下 `NEXT_REVALIDATE_SECOND` 默认 3600，TTFB 不再受 Notion 回源影响。
- 静态导出预研结论：`pages/[prefix]/[slug]` 已有 `isExport()` 分支与 `prefetchAllBlockMaps`，git 模式下不再有外部依赖，
  `npm run export` 理论可全量预渲染；但 RSS/sitemap/redirect 的产物生成依赖运行时 IPC 缓存，需要单独调整，本次未改动，
  列为 P4 PWA 的前置可选项。

---

## 七、验收

| 项 | 结果 |
|---|---|
| 同步产物 | 见下方「本次同步结果」，图片全部落在 `public/images/notion/` |
| 幂等 | 连跑两次，第二次 1.5 秒完成、0 篇重写、0 张图片重下（日志无逐篇输出） |
| git 模式构建 | `CONTENT_SOURCE=git npm run build` 通过（47 个页面，文章页 191 kB），`getStaticPaths` 无一次回源 Notion |
| 断网验证 | git 模式下 loader 只读 fs；构建日志里没有第二次 Notion 请求 |
| 搜索索引 | `--source=md` 秒级生成，13 页入库（文章按 sitemap 匹配出真实地址 `/article/xxx`） |

### 本次同步结果

| 项 | 数值 |
|---|---|
| 站点 | 1 个（`NOTION_PAGE_ID` 未配多语言站点） |
| 文章/页面 | 17 篇（其中 16 篇有 slug） |
| 产物体积 | `content/` 4.9 MB，`public/images/notion/` 6.9 MB / 35 张 |
| 同步耗时 | 全量约 1 分钟（17 篇 × 2.5s 间隔 + 图片下载） |
| 失败 | 0 篇；1 张 attachment 图片（`fetch failed`）保留原地址 |

踩到的坑，已写进脚本注释：

1. **裸 node 脚本不会加载 `.env.local`**。不显式 `loadEnvConfig` 就会退回 `blog.config` 里的默认 `NOTION_PAGE_ID`（模板示例站），
   同步出一整套模板文章，站点看起来正常但全是示例内容。`scripts/sync-notion.js` 第一行就加载 env。
2. **block 是双层嵌套**（`{spaceId, value:{value:{...}}}`），按单层取值会让 markdown 全空。
3. **内容块的 `content` 字段可能缺失**，在 `renderBlocks` 里直接 `for...of` 会抛 `blockIds is not iterable`，一圈看下来像 Notion 报错，实际是自己的锅。
4. **多语言站点标题重复**，文件名要全局唯一，否则两个站点互相覆盖。

### 已知限制

| 项 | 说明 |
|---|---|
| 单页 403 | 少数页面 Notion 拒绝 `loadPageChunk`（无权限/未公开），同步跳过并保留上次内容，日志里能看到具体 id |
| 删除文章 | 从 Notion 删掉的文章不会自动清理 `content/pages/` 下的旧文件，同步结束会列出待清理清单，需手动删 |
| 图片签名 | 同步后内容里的图片都是本地路径，不再依赖 Notion 签名；没下载成功的会保留原始外链，一周内可能失效 |
