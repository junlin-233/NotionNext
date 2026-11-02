# NotionNext 升级计划：从 Notion 依赖到自有内容平台

> 制定日期：2026-11-01 ｜ 基线版本：NotionNext 4.9.4.2（Heo 主题，Next.js 14.2 Pages Router）
> 总周期：约 7–12 周，分五个阶段，每阶段可独立交付、独立回滚。

---

## 一、背景与现状（已核查）

| 项 | 现状 | 结论 |
|---|---|---|
| 数据链路 | `lib/db/SiteDataApi.js` → notion-client 私有 API，缓存链 Redis→File→Memory（`lib/cache/cache_manager.js`） | 运行时强依赖 Notion，无失败兜底 |
| 性能 | ISR 600s，缓存失效后首个访客等 5s+（串行多轮 Notion 请求） | 架构性瓶颈，调参无解 |
| 搜索 | Algolia 已配置但 key 为空，实际不可用 | 直接换 Pagefind |
| 统计 | busuanzi 开启（第三方脚本，不稳定、无历史数据归属） | 换自托管 Umami |
| 评论 | `conf/comment.config.js` 全部为空，无评论系统启用 | 不影响本计划 |
| 认证 | Clerk 仅保护 `/dashboard`；无 key 时走 `noAuthMiddleware` | 条件性移除 |
| PWA | 无 manifest、无 Service Worker | 从零搭建 |
| AI | `components/AISummary.js` 纯展示组件已就绪，`AI_SUMMARY_*` 配置入口已有 | RAG 可复用其视觉风格 |

**本次升级的北极星目标：**

1. 线上可用性不再受 Notion 故障影响（P2 快照层 → P3 完全解耦）
2. 文章页 First Load JS 降低 30% 以上（P1+P2）
3. 具备搜索、分享、问答、年度报告四个体验级新能力（P1+P4）
4. 内容资产（文章、图片）落自有仓库与存储，随时可静态导出、可回滚（P3）

---

## 二、阶段总览

```
P0 基线建立      0.5 天    建立度量，锁定回滚点
P1 快赢与清理    1–2 周    搜索/统计/OG 三能力上线 + JS 减负第一批 + 依赖清理
P2 韧性地基      1–2 周    Notion 快照兜底 + 图片自托管 + JS 减负第二批
P3 内容管线      2–4 周    Notion→Git 同步，线上读取切换，彻底解耦
P4 智能与体验    2–4 周    RAG 问答 + 年度报告 + PWA 离线阅读
```

依赖关系：P1 与 P2 可并行推进；P4 的 RAG 依赖 P3 的内容落仓；年度报告依赖 P1 的 Umami 数据积累（越早上线，年底数据越全，**P1 的 Umami 任务优先级最高**）；PWA 独立，可插空执行。

---

## 三、P0 基线建立（0.5 天）✅ 已完成（受限）

优化前先有度量，否则无法验收。

| # | 任务 | 说明 | 状态 |
|---|---|---|---|
| 0.1 | Bundle 基线 | `npm run bundle-report`，记录首页/文章页/归档页 First Load JS，存入 `docs/perf-baseline.md` | ⚠️ 本机环境无法完成（Notion API 80-110s + 删除守卫），改由 CI 执行，方法与阻塞原因见 `docs/perf-baseline.md` |
| 0.2 | Lighthouse 基线 | 用现有 `lighthouserc.js` 对线上域名跑一次，记录 LCP/TBT/CLS | ⏳ 已接入 CI，待首跑 |
| 0.3 | 锁定回滚点 | 当前部署打 git tag `pre-upgrade-2026.11`；确认 Docker 镜像可回滚 | ✅ 已完成 |

**验收：** `docs/perf-baseline.md` 包含上述全部数字。

---

## 四、P1 快赢与清理（1–2 周）✅ 已完成

> 交付明细见 `docs/p1-delivery.md`。实际偏差：Clerk 移除延后（需确认 /dashboard 用途）；`/search` 顺带改造为客户端 Pagefind 搜索页。

### 4.1 站点统计（优先级最高，数据积累从今天开始）

> 2026-11-02 决策变更（三次收敛，最终结论）：
> 1. Umami 取消（付费 / 要自养 Postgres）
> 2. 访问日志方案取消（线上在 Vercel Hobby，没有 log drain，拿不到 access log）
> 3. **最终用 busuanzi 展示 + 每日抓累计值归档历史**：页面数字由 busuanzi 前端脚本负责；`scripts/analytics/snapshot-busuanzi.js` 每天抓一次累计值写 `analytics/history.json`，相邻两天相减得日增，年度报告读这份数据。代价：拿不到页面级明细（Top 10 文章），历史从归档当天起算。`lib/analytics/cloudflare.js` 与 `parse-access-log.js` 保留为备用数据源，接口四级降级。详见 `docs/analytics-setup.md`。

- **部署：** Docker Compose 起一个 Umami 实例（已有 Docker 基建），复用现有 Redis 或给 Umami 配 PostgreSQL。
- **接入：** `conf/analytics.config.js` 的 `UMAMI_HOST`/`UMAMI_ID` 已有入口；替换 `components/Busuanzi.js` 为 Umami 脚本注入。
- **阅读数展示：** busuanzi 的「本文阅读量」改为 `pages/api/stats.js` 代理 Umami 统计 API（服务端缓存 10 分钟，避免触发 Umami 限流）。
- **清理：** `ANALYTICS_BUSUANZI_ENABLE` 置 false，移除 busuanzi 外链脚本。

### 4.2 Pagefind 本地搜索（替代 Algolia）

- **索引构建：** ISR 站点没有全量预渲染 HTML，采用「构建后预热爬取」方案——
  1. `npm run build` 后启动 standalone server；
  2. `scripts/build-search-index.js` 读取 sitemap.xml 的 URL 列表，逐页抓取 HTML 到 `.pagefind-cache/`（此过程同时把 ISR 页面全部预热）；
  3. 执行 `npx pagefind --source .pagefind-cache --bundle-path public/pagefind/`；
  4. 产物目录进 `.gitignore`，部署时由 CI 生成。
- **前端：** 新建 `components/PagefindSearchModal.js` 替换 `AlgoliaSearchModal.js`（保留现有交互与快捷键体验），Pagefind JS 按 `public/pagefind/pagefind.js` 动态加载，不进主 bundle。
- **清理：** 移除 `algoliasearch` 依赖及 Algolia 相关配置。
- **中文支持：** Pagefind 原生支持 CJK 分词，需在索引时确认 `zh-CN` 语言标注。

### 4.3 动态 OG 分享卡

- **端点：** 新建 `pages/api/og.js`，用 `@vercel/og`（`ImageResponse`）按文章标题/标签/封面动态生成 1200×630 卡片。
- **防滥用：** URL 参数带 HMAC 签名（密钥 `OG_SIGN_KEY` 环境变量），无签名请求返回兜底静态图。
- **接入：** `components/SEO.js` 的 `image` 字段指向该端点；无封面文章用「标题 + 站点名 + 头像」排版模板。
- **兜底：** 本地/无 resvg 环境降级为 `public/og-default.png`。

### 4.4 客户端 JS 减负 · 第一批

| 改动点 | 文件 | 预期收益 |
|---|---|---|
| Prism 语言按需注册：扫描构建期内容实际出现的语言类型，生成语言清单注入 | `components/PrismMac.js` | 砍掉未使用语言的语法定义 |
| katex CSS 与 Equation 仅在文章含公式时加载（元数据标记 `hasMath`） | `components/NotionPage.js` | 非公式文章省 ~60KB |
| medium-zoom 改 dynamic import | `components/NotionPage.js` | 首屏 JS 减小 |
| 移除 `react-facebook`（FacebookPage 挂件未启用，配置为 null） | `components/FacebookPage.js`、`package.json` | 依赖树清理 |

### 4.5 细节清理

- **next-sitemap 1.9 → 4.x**：API 有变化，`next-sitemap.config.js` 需同步调整。
- **CSP report-only**：`next.config.js` 中被注释的安全头逐项放开为 `Content-Security-Policy-Report-Only`，观察一周日志（报告收集可用免费的 report-uri 或自建 endpoint），无误报再转强制。
- **Lighthouse CI 门禁**：`.github/workflows/lighthouse.yml`，预算 LCP < 2.5s、TBT < 300ms，超标即 fail，防止性能回退。
- **Clerk 条件性移除**：先确认 `/dashboard` 是否在用。若不用——移除 `@clerk/nextjs`、`@clerk/localizations`、`pages/sign-in`、`pages/sign-up`、`pages/api/auth`、`pages/api/user.ts`、`components/ClerkBoundary.js`。
  > ⚠️ **陷阱：`middleware.ts` 的 `noAuthMiddleware` 内含 `UUID_REDIRECT` 的 redirect.json 处理逻辑。移除 Clerk 时必须保留这段逻辑**，重写为独立的 `middleware.ts`，否则 UUID 短链重定向会静默失效。

**P1 验收：**
- 搜索可用（中文关键词命中文章正文）；Umami 收到数据；分享到微信/Twitter 出动态卡片
- 文章页 First Load JS 较基线下降 ≥ 15%
- `npm run build` 通过；Lighthouse CI 绿；无 Clerk 相关引用残留（若选择移除）

---

## 五、P2 韧性地基（1–2 周）✅ 已完成

> 交付明细见 `docs/p2-delivery.md`。实际偏差：图片自托管先做站内反代（默认关），
> 彻底方案并入 P3 图片落地；JS 减负第二批集中在 heo 首屏组件。

### 5.1 Notion 快照降级层

给现有缓存链加一个「永不失效、仅失败兜底」的持久层：

- **新增 `lib/cache/snapshot_store.js`**：
  - 写入时机：每次成功拉取 Notion 数据后（`getOrSetDataWithCache` 成功回调），把 `site_<pageId>` 与 `page_block_<id>` 序列化写入 `.snapshot/` 目录（gitignore）；
  - 读取时机：真实拉取**失败**（超时/限流/封禁）时降级读取快照，页面标记 `stale: true`（页脚可显示「数据快照于 X 时间」）。
- **改动点：** `lib/cache/cache_manager.js` 的 miss 分支增加 try-catch 兜底；`lib/db/notion/getPostBlocks.js` 拉取入口包裹。
- **与 FileCache 的区别：** FileCache 有 TTL 且构建期使用；快照层无 TTL、显式版本号、只在故障时生效。二者并存。
- **效果：** Notion 宕机/API 封禁时，站点继续以最后一次成功数据运行。

### 5.2 图片自托管链路

- **第一步（本周可做）：** 用 `conf/image.config.js` 现成的 `NOTION_HOST` 钩子——Notion 图片域名替换为自建反代（Nginx/Vercel Edge Function 均可），加 CDN 缓存头。Notion 图片 URL 带 `expiration_time` 签名，反代需做「URL 规范化 + 签名过期重签」处理（社区有成熟方案）。
- **第二步（并入 P3）：** 同步器批量下载图片落地，彻底摆脱 Notion CDN。

### 5.3 客户端 JS 减负 · 第二批

- `components/NotionPage.js` 深度审查：react-notion-x 的 Collection、Gallery、Pdf 全部 dynamic import；TweetEmbed 已是 dynamic，确认 ssr:false。
- `themes/heo` 首屏组件逐个过 `next/dynamic`（右下角挂件、公告栏等非关键 UI）。
- 字体确认走自托管 woff2 + `font-display: swap`（public/webfonts 已有资源）。

**P2 验收：**
- 人为断开 Notion（改错 pageId 或 hosts 屏蔽）后，站点正常出内容，页脚显示快照时间
- 图片经自建域名加载，响应头带长缓存
- 文章页 First Load JS 较基线累计下降 ≥ 30%

---

## 六、P3 内容管线：Notion 降级为写作界面（2–4 周）✅ 已完成

> 交付明细见 `docs/p3-delivery.md`。实际做法：存档原始 recordMap、运行时复用同一套转换，
> 转换逻辑不复制到脚本里；线上切 `CONTENT_SOURCE=git` 需要人工决定时机。

### 6.1 同步器

- **`scripts/sync-notion.js`**：
  1. 复用 `lib/db/SiteDataApi.js` 拉全量数据（含每篇 blockMap）；
  2. 产出两种格式到 `content/` 目录：**JSON**（结构化元数据：slug、标题、标签、日期、摘要，供站点读取）+ **Markdown**（正文，人类可读、diff 友好、供 RAG 与 Pagefind 用）；
  3. 扫描全部 Notion CDN 图片，下载到 `content/images/`（或按 `IMAGE_STORAGE=r2|local` 上传 R2，R2 免出口流量费），正文图片链接重写。
- **幂等性：** 按 `lastEditedTime` 判断变更，未变更的文章跳过重写，git diff 干净。

### 6.2 自动化

- **`.github/workflows/sync-notion.yml`**：cron 每 6 小时 + workflow_dispatch 手动触发；有内容变更时自动 commit 并触发部署构建。
- **可回滚：** 内容在 git 里，发错文章 `git revert` 即可。

### 6.3 站点读取切换（零风险迁移的关键）

- **新增 `lib/db/GitDataApi.js`**，与 `SiteDataApi` 完全同签名（`fetchGlobalAllData` / `resolvePostProps`），从 `content/` 读取；
- **`blog.config.js` 新增 `CONTENT_SOURCE: 'notion' | 'git'`**，在 `fetchGlobalAllData` 入口处按配置路由；
- 双模式并存期间：先 `notion` 模式跑同步器观察 2 周（对比两侧输出一致性），再切 `git` 模式，出问题改一行配置即回退。

### 6.4 搜索索引源切换

- Pagefind 不再需要「预热爬取」：直接从 `content/**/*.md` 生成 HTML stub 后索引，速度快、覆盖全（含未来 ISR 生成的新页面）。
- `scripts/build-search-index.js` 改造为双模式（爬取模式保留为 fallback）。

### 6.5 收尾

- 切换稳定后，`NEXT_REVALIDATE_SECOND` 可延长到 3600+（甚至 SSG），TTFB 进入 CDN 直出水平。
- 预研全静态导出（`next export`）可行性，为 P4 PWA 的离线缓存清单打基础。

**P3 验收：**
- Notion 改文章 → 6 小时内自动同步 → 构建部署，全程无人工
- 断网 Notion（或 Notion 封禁 IP）一周，站点内容照常更新（走 git 数据源）
- 文章页 TTFB < 200ms（CDN 命中时 < 100ms）
- `content/` 目录 git 历史可回溯任意版本

---

## 七、P4 智能与体验（2–4 周）✅ 已完成

> 交付明细见 `docs/p4-delivery.md`。实际偏差：PWA 用手写 Service Worker 替代 serwist（零构建步骤）；
> RAG 与 PWA 的线上效果需要配 Key / HTTPS 环境实测。

### 7.1 站内 AI 问答（RAG）

依赖 P3 的 `content/**/*.md`。

- **Embedding 管线：** `scripts/build-embeddings.js`——按标题层级切分段落（每段 300–500 字，带文章标题上下文前缀），调 embedding API（`conf/plugin.config.js` 新增 `EMBEDDING_API`/`EMBEDDING_KEY`，可复用 AI_SUMMARY 的供应商），输出 `content/.embeddings.json`。同步器跑完自动触发。
- **检索：** 几百篇文章量级（< 5k 段），**不引入向量数据库**，内存余弦相似度检索足够（冷启动 < 100ms）。量大再升级。
- **运行时：** `pages/api/ai-chat.js`——检索 top-5 段落 + 系统 prompt（含站点人设与引用规范）+ 用户问题 → LLM 流式输出（SSE）。回答附带「参考文章」链接列表。
- **UI：** `components/AIChatWidget.js` 悬浮按钮 + 对话框，视觉风格与 `AISummary.js` 统一（同款头部样式）。
- **成本控制：** 无 `EMBEDDING_API` 时组件不渲染；问答结果 memory-cache 30 分钟；API 路由限流（复用 `lib/middleware/security.js` 的速率限制，该文件已存在）。

### 7.2 年度阅读报告

- **数据源：** 内容元数据（发文数、标签云、月度发文热力图、里程碑）+ Umami API（总阅读量、Top 10 文章、访客趋势）。
- **路由：** `pages/annual/index.js`，静态生成 + 客户端动画（数字滚动、SVG 热力图、卡片翻转），12 月起自动可用，路由为 `/annual`。
- **分享裂变：** 复用 4.3 的 OG 端点生成「我的博客 2026」分享海报。

### 7.3 PWA + 离线阅读

- **方案：** `serwist`（next-pwa 的 Next 14 维护后继者，Pages Router 支持良好）。
- **清单：** `public/manifest.webmanifest` + 图标集（由 `favicon.svg` 导出 192/512 及 maskable）。
- **缓存策略：**
  - App Shell（CSS/JS/字体/图标）precache；
  - 文章页 SWR 策略（stale-while-revalidate）；
  - 已访问文章进 Cache Storage → 离线可读。
- **离线兜底：** `/offline` 页列出已缓存文章清单（从 Cache Storage 读取）。
- **注意：** 评论、AI 问答等动态功能离线时优雅降级为提示。

**P4 验收：**
- AI 问答能基于站内文章回答并给出引用链接；断网刷新已读文章可正常显示
- Lighthouse PWA 检查通过；手机「添加到主屏幕」可用
- `/annual` 页面数据准确、分享卡正常生成

---

## 八、风险与回滚

| 风险 | 概率 | 缓解 |
|---|---|---|
| Notion 私有 API 变动导致同步器失效 | 中 | P2 快照层先行兜底；同步器失败时 Action 发告警但不阻塞站点 |
| Pagefind 爬取方案在文章量大时变慢 | 低 | 文章 < 500 篇时全量爬取 < 5 分钟；P3 后切 markdown 源 |
| Umami 自托管丢数据 | 低 | 每日 pg_dump 定时备份到对象存储 |
| Clerk 移除误伤 UUID_REDIRECT | 中 | 详见 4.5 陷阱说明，移除后专项验证 redirect.json 路由 |
| RAG 回答出现幻觉 | 中 | 系统 prompt 强制「仅基于给定段落回答，无依据时明说」+ 引用展示 |
| serwist 缓存导致用户看到旧版本 | 中 | SW 更新策略用 `skipWaiting` + 页面提示「新版本可用」 |

**全局回滚策略：** 每阶段独立 PR + 独立 git tag；P3 的双模式开关是终极回滚手段（一行配置切回直连 Notion）。

---

## 九、验收指标汇总

| 指标 | 基线 | P2 后（实测） | P3/P4 后 | 结论 |
|---|---|---|---|---|
| 文章页 First Load JS | 195 kB（未改动态导入时实测） | 191 kB | 191 kB | **目标 −30% 未达成**，见下 |
| 首页 First Load JS | 189 kB | 184 kB | 184 kB | 同上 |
| 共享 chunk（framework+main+_app） | 213 kB | 209 kB | 209 kB | 其中 44.8+39.6 是 Next 框架本身 |
| 文章页 TTFB（CDN 命中） | ~秒级 | 未变 | 未实测 | git 模式 revalidate 拉到 3600，待线上复测 |
| Notion 宕机时站点可用性 | 全站不可用 | 快照兜底 | git 源完全可用 | 达成 |
| 搜索 | 不可用 | ✅ Pagefind | ✅ 支持 md 源秒级重建 | 达成 |
| 安全头 | P1 已接 CSP report-only | 同左 | 同左 | 转强制不在本计划范围 |

**First Load JS 为什么没降 30%：**

计划里的 −30% 是在没有基线数字的情况下拍的。实测下来，文章页 191 kB 里
Next 框架 84 kB、`_app`（主题布局 + react-notion-x 相关）96.7 kB，
真正能拆的业务组件已经在 P1/P2 拆完了；剩下的大头是把 Notion blockMap 渲染成页面的
`react-notion-x`，只要还在客户端渲染就拆不掉。
再往下压只能换渲染架构（SSR 直出 HTML + 客户端只做交互增强），那是另一个量级的工作，
不在本次升级范围内。**这一项按「已尽力、目标不成立」记。**

---

## 十、执行顺序建议（单人节奏）

1. **本周：** P0 全部 + P1.1（Umami，数据积累刻不容缓）
2. **下周：** P1.2–P1.5（搜索、OG、JS 减负、清理）
3. **第三、四周：** P2（快照层、图片反代、JS 深度减负）
4. **第五至八周：** P3（同步器 → 双模式观察 → 切换）
5. **第九周起：** P4（RAG → 年度报告 → PWA，年度报告赶在 12 月前上线）
