# 项目结构与架构导览

> 2026-11-03 ｜ 配套日常流程看 `docs/dev-workflow.md`；分期交付记录看 `docs/p1~p4-delivery.md`

## 一、这是什么

NotionNext（Next.js Pages Router）+ heo 主题的 fork。线上部署 Vercel，内容源 `CONTENT_SOURCE=git`：Notion 内容由 GitHub Action 定时同步进仓库的 `content/`，构建时读仓库，不实时拉 Notion。

## 二、数据流

```
Notion（写作）
  → sync-notion.yml（每 6 小时 / 手动）
      写 content/ + 图片下到 public/images/notion/
      重建搜索索引（scripts/build-search-index.js）
      重建 RAG 向量（scripts/build-embeddings.js）
      提交 main → Vercel 构建 → 上线
  → 本地开发可选 notion 源实时拉
```

数据读取两条路，入口都在 `lib/db/`：

| 源 | 读取层 | 说明 |
| --- | --- | --- |
| git | `lib/db/git/loader.js` | 线上同款，读 `content/` |
| notion | `lib/db/notion/`（getNotionAPI、getPostBlocks 等） | 本地调样式用，实时拉 |

上层统一走 `lib/db/SiteDataApi.js`，页面不关心源。缓存层在 `lib/cache/`（本地文件 / 内存 / redis / 快照降级四套）。

## 三、目录导览

| 目录 | 放什么 | 什么时候动它 |
| --- | --- | --- |
| `themes/heo/` | 主题全部：`config.js`（63 个 `HEO_` 开关）、`index.js`（布局组装）、`components/`（约 40 个页面组件）、`style.js` | 改样式、改组件、改文案，**绝大多数改动在这里** |
| `components/` | 主题无关的通用组件（评论、LazyImage、AIChatWidget、AISummary、全局样式等） | 加通用能力，多主题共用时才放这 |
| `pages/` | Next.js 路由：`index.js` 首页、`[prefix]/` 文章与 Page 页、`api/` 接口（ai-chat、og、stats、views、subscribe 等） | 加页面、加接口 |
| `conf/` | 站点级配置拆分文件（notion、comment、analytics、ai 等 17 个） | 改站点级功能开关 |
| `blog.config.js` | 站点主配置（标题、域名、内容源） | 改站点基础信息 |
| `lib/` | 数据层（db）、配置读取（config）、全局状态（global）、工具（utils）、缓存（cache）、AI（ai）、OG 图（og） | 改数据逻辑、加数据能力 |
| `content/` | 同步下来的 Notion 内容（git 源的数据） | 不手改，由同步脚本写 |
| `scripts/` | 构建/同步/检查脚本：sync、build-search-index、build-embeddings、health-check | 改同步与构建流程 |
| `public/images/notion/` | 同步下来的图片 | 不手改，和 `content/` 一起提交 |
| `data.json` | 构建期数据缓存（已 gitignore） | 构建数据旧就删它 |

## 四、改动定位速查

| 想改什么 | 去哪 |
| --- | --- |
| 首页英雄区、通知条、头像、签名 | `themes/heo/config.js` + `themes/heo/components/Hero.js`、`NoticeBar.js` |
| 文章卡片、列表样式 | `themes/heo/components/BlogPostCard.js`、`BlogPostListPage.js` |
| 顶部导航、侧栏菜单 | `themes/heo/components/Header.js`、`MenuListTop.js`、`MenuListSide.js` |
| 页脚 | `themes/heo/components/Footer.js` |
| AI 对话 / 摘要 | `components/AIChatWidget.js`、`AISummary.js`，后端 `pages/api/ai-chat.js`，知识层 `lib/ai/knowledge.js` |
| 文章阅读量、统计 | `pages/api/views.js`、`stats.js`，`lib/analytics/` |
| OG 分享图 | `pages/api/og.js`、`lib/og/sign.js` |
| 搜索 | 同步时生成的搜索索引 + `pages/search/` |

## 五、构建与校验链

```bash
npm run dev          # 开发（notion 源）
CONTENT_SOURCE=git npm run build && npm run start   # 线上同款验证
npm run sync:content # 手动内容同步
npm run build:search / build:embeddings   # 单独重建索引/向量
npm run lint         # 提交前自检
```

注意：用 `npm run build`，别直接 `npx next build`（会撞 `public/sitemap.xml`，详见 dev-workflow 踩坑表）。
