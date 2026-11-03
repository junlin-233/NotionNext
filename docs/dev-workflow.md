# 日常流程：启动 / 更新 / 推送

> 2026-11-03 ｜ 线上 Vercel，内容源 `CONTENT_SOURCE=git`，内容来自 `content/`

## 一、启动

```bash
npm install              # 首次，或依赖变化后
npm run dev              # http://localhost:3000
npm run dev -- -p 3010   # 换端口
```

两种内容源，按用途选：

| 模式 | 命令 | 数据从哪来 | 什么时候用 |
| --- | --- | --- | --- |
| notion（默认） | `npm run dev` | 实时拉 Notion | 调样式、调交互，改完 Notion 刷新就有 |
| git（线上同款） | `CONTENT_SOURCE=git npm run dev` | 读仓库里的 `content/` | 复现线上数据、验证内容同步结果 |

## 二、更新

### 改代码

| 改什么 | 在哪 |
| --- | --- |
| 主题组件、样式 | `themes/heo/components/` |
| 站点文案、主题开关 | `themes/heo/config.js`（`HEO_` 开头） |
| 站点级配置 | `blog.config.js`、`conf/*.js` |
| 通用组件 | `components/` |

改完自检：

```bash
npm run lint
npx prettier --check <改动的文件>
```

### 改内容

在 Notion 里改，然后二选一：

- **等**：GitHub Action 每 6 小时跑一次（UTC 0/6/12/18 点过 17 分），`.github/workflows/sync-notion.yml`
- **手动**：Actions 里点 `Run workflow`，要全量重写就勾 `force`

同步脚本做四件事：写 `content/`、把图下到 `public/images/notion/`、重建搜索索引、重建 RAG 向量，最后提交并触发部署。

本地手动跑（`.env.local` 需要 `NOTION_TOKEN_V2`）：

```bash
npm run sync:content              # 增量
npm run sync:content -- --force   # 全量
npm run sync:content -- --dry-run # 只看要做什么
```

图片和 `content/` 必须一起提交，漏了就是线上破图——2026-11-03 友链头像 404 就是漏了 10 张。

### 改文案 / 开关

`themes/heo/config.js`，头像 URL、通知条、签名、英雄区标题都在这里。

### 改完必须刷新看效果

构建过、lint 过都不算验证，浏览器里刷新看到才算。页面更新是"改 → 刷新 → 看"，不是"改 → 构建成功 → 收工"。

- **本地**：改了 `blog.config.js`、`conf/*.js`、`themes/heo/config.js`，或者布局层、`dynamic(ssr:false)` 的懒加载组件之后，热更新经常跟不上，手动刷新页面（`cmd+shift+R`），还不对就重启 `npm run dev`
- **线上**：部署完开无痕窗口或硬刷新；还是旧内容先看响应头 `age`，那是页面缓存没到期，不是改动没生效

## 三、推送

```bash
git add -A
git commit -m "fix(heo): 一句话说清改了什么"
git push origin main
```

- push 到 main 就触发 Vercel 构建，1~3 分钟上线
- CI 也会往 main 推内容，push 被拒先 `git pull --rebase origin main` 再推
- 提交前缀沿用现有：`feat` / `fix` / `chore` / `docs`

## 四、多久生效

**UI 改动立即生效，数据层改动可能滞后。**

| 层 | 有效期 | 说明 |
| --- | --- | --- |
| 页面 ISR | `NEXT_REVALIDATE_SECOND`：git 源 3600s、notion 源 600s | 重新部署不保证清掉 |
| 站点数据缓存（构建期） | 无（Vercel 上没有 `data.json`） | 构建机 miss，等于没缓存 |
| 站点数据缓存（运行时） | 仅 `ENABLE_CACHE=true` 时，TTL = 上述值 × 1.5 | 默认关闭 |
| 快照降级 | 无过期 | 拉 Notion 失败才读，git 源关闭 |

判断和验证：

1. 线上看响应头 `age`，小于 revalidate 值就是旧页面，等它过期
2. `?cb=` 之类 query 绕不过去，ISR 缓存按 pathname 存
3. 想立刻看结果，本地按生产模式跑：`CONTENT_SOURCE=git npm run build && npm run start`

改派生数据（`latestPosts`、`tagOptions`、`categoryOptions`、`customNav`、`customMenu`、`allNavPages`、`postCount`）的排序或聚合逻辑时，放 `handleDataBeforeReturn` 里请求期算，别留在 `convertNotionToSiteData` 跟着缓存走。

## 五、踩过的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `npx next build` 报 `Conflicting public and page file: /sitemap.xml` | 预构建要删 `public/sitemap.xml`，只有 `npm run build` 会触发 | 用 `npm run build`，别直接调 bin |
| 本地构建出来数据是旧的 | 根目录 `data.json` 是构建期缓存（已在 .gitignore） | `rm data.json` 再构建 |
| 点侧栏头像、顶部菜单进 `/about`、`/links` 空白，标题 `undefined \| loading` | 这类 Notion Page 页面没被预生成，`_next/data` 请求被回落成页面 HTML | 已修：`pages/[prefix]/index.js` 把 `type=Page` 一起预生成 |
| 友链/文章图片线上 404 | 同步下来的图没提交 | `git add public/images/notion` |
