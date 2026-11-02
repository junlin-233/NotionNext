# P4 交付说明（智能与体验）

> 更新日期：2026-11-02 ｜ 对应计划：`UPGRADE_PLAN.md` 第七节

---

## 一、站内 AI 问答（计划 7.1）

| 文件 | 职责 |
|---|---|
| `scripts/build-embeddings.js` | 按 Markdown 标题切段 → 调 embedding 接口 → 写 `content/.embeddings.json`（不进 git） |
| `lib/ai/knowledge.js` | 读向量文件（按 mtime 缓存）、余弦相似度检索 top-k、拼上下文、生成引用列表 |
| `pages/api/ai-chat.js` | 问题向量化 → 检索 → LLM 流式回答（SSE），带限流与 30 分钟答案缓存 |
| `components/AIChatWidget.js` | 右下角悬浮入口 + 对话面板，视觉沿用 `AISummary` 的红色渐变头部 |

关键取舍：

- **不引入向量数据库**。全站几十篇文章、几千段文本，`JSON + 内存余弦` 冷启动 <100ms，加一层向量库只是多一个要运维的东西。
- **切段带上下文**：段前拼「文章标题 · 小标题」，模型能分清在讲哪篇；引用列表直接用 `slug` 拼链接。
- **只基于片段回答**：系统 prompt 明确「片段里没有就说没有」，回答里用 `[1] [2]` 标注来源，前端渲染成文章链接。
- **成本控制**：答案按问题文本缓存 30 分钟；单 IP 每分钟 6 次；问题截断到 200 字；没配 `AI_CHAT_API_KEY` 时接口直接 503，前端不渲染入口。
- **Key 不进前端**：`AI_CHAT_*` 只在 API 路由里从 `process.env` 读；`blog.config` 里只放 `NEXT_PUBLIC_AI_CHAT_ENABLE` 这个布尔开关。

用法：

```bash
# 1) 生成向量（需要 embedding key）
EMBEDDING_API_KEY=sk-xxx npm run build:embeddings

# 2) 配好 AI_CHAT_API_KEY 等变量，打开前端开关
NEXT_PUBLIC_AI_CHAT_ENABLE=true

# 3) 同步器跑完内容后建议重跑一次 embedding，只对变更段落重新请求
```

SSE 协议：`{"type":"citations"}` → 若干 `{"type":"delta"}` → `[DONE]`，缓存命中也按同一协议回放，前端只实现一种解析。

---

## 二、年度报告（计划 7.2）

`pages/annual/index.js`，路由 `/annual`，ISR 3600。

| 数据块 | 来源 |
|---|---|
| 文章总数 / 年度新增 / 月度发文 / 活跃月份 | `fetchGlobalAllData` 的 `allPages`（notion、git 两种模式都通） |
| 年度阅读 / 累计阅读 / 访客 | `analytics/history.json`（busuanzi 每日归档，相邻两天相减） |
| 阅读排行 Top 10 | `lib/views` 的 Redis 排行（`getTopViews`），没配 Redis 不显示该区块 |
| 分享卡 | `/api/og-annual?year=YYYY`（2026-11-02 新增）：服务端取数拼标题/摘要并 HMAC 签名后 302 到 `/api/og`，签名不进前端 |

已知取舍：busuanzi 只给站点累计值，拿不到页面级历史，
所以这里有「站点年度增量」和「文章当前排行」，没有「某篇文章今年的阅读量」。
要补这一块，得换回有页面级时序的统计源（P1 评估过，Vercel Hobby 拿不到 access log）。

---

## 三、PWA 与离线阅读（计划 7.3）

**没有用 serwist**，手写了 `public/sw.js`。原因：serwist 需要挂 webpack 插件、生成 precache manifest，
而这个站点的静态资源带 hash、内容页走 ISR，运行时缓存已经够用；
手写零依赖、零构建步骤，改完就生效，也不会因为构建环境问题引入新的失败点。

| 文件 | 职责 |
|---|---|
| `public/sw.js` | 安装时预缓存 `/offline`；`/_next/static`、`/images` cache-first；页面导航 stale-while-revalidate；`/api/*` 只走网络，离线返回 503 JSON |
| `components/ServiceWorker.js` | 生产环境注册；检测到 waiting worker 时底部提示「新版本可用」，点了才刷新 |
| `pages/api/manifest.js` | manifest 走接口，站名跟 `blog.config` 走，不用在静态文件里再抄一份品牌 |
| `public/icons/*.png` | 192 / 512 / 512-maskable / apple-touch-icon，由 `favicon.svg` 用 sharp 生成（sharp 只是本地一次性工具，没进依赖；要重生成临时 `npm i -D sharp` 即可） |
| `pages/offline/index.js` | 客户端读 Cache Storage，列出已缓存文章；标题从缓存 HTML 的 `<title>` 取，不需要额外索引接口 |
| `pages/_document.js` | 挂 `manifest`、`theme-color`、`apple-touch-icon` |

离线行为：
- 读过的文章断网可打开（页面进 pages 缓存）；
- 没读过的页面断网落到 `/offline`；
- 评论、AI 问答、阅读数等依赖接口的功能离线时返回失败，页面不会白屏。

---

## 四、验收

| 项 | 结果 |
|---|---|
| 构建 | `npm run build` 通过，新增路由 `/annual`、`/offline`、`/api/ai-chat`、`/api/img`、`/api/manifest` 均在路由表里 |
| 单测 | 新增 `__tests__/scripts/notionMarkdown.test.js`（5）、`notionImages.test.js`（7） |
| RAG | 不配 Key 时 `/api/ai-chat` 返回 503 且入口不渲染；配 Key 后能检索到站内文章并给引用链接（需真实 Key 才能跑通，本机未配置） |
| PWA | manifest 与 SW 均可达；「添加到主屏幕」与 Lighthouse PWA 检查需要在线上 HTTPS 环境实测 |
| 年度报告 | `/annual` 用现有 `analytics/history.json`（单点数据）与文章元数据渲染正常 |

### 未完成 / 需要线上验证

| 项 | 说明 |
|---|---|
| Lighthouse PWA 实测 | 本机没有 Chrome，`lhci` 只能在 CI 跑；`skipWaiting` 与离线页行为需要真机确认 |
| RAG 端到端 | 需要配 `AI_CHAT_API_KEY` + 跑一次 `build:embeddings`；本机无 Key，只验证了降级路径 |
| 年度报告数据完整度 | 统计归档从 2026-11-02 开始，年度增量要等累积一段时间才有意义 |
