# P1 交付说明（快赢与清理）

> 完成日期：2026-11-01 ｜ 对应计划：`UPGRADE_PLAN.md` 第四节
> 回滚点：git tag `pre-upgrade-2026.11`

---

## 一、变更清单

### 1.1 Umami 自托管统计（替代 busuanzi）

| 文件 | 变更 |
|---|---|
| `conf/analytics.config.js` | 重构 Umami 配置：`UMAMI_HOST`（实例地址）、`UMAMI_ID`、`UMAMI_API_TOKEN`（服务端）、`UMAMI_STATS_SINCE`；busuanzi 默认改为关闭 |
| `pages/_document.js` | 配置了 HOST+ID 时自动注入 Umami 跟踪脚本 |
| `components/UmamiAnalytics.js` | 新增：路由切换自动上报 pageview；回填 `busuanzi_value_*` 节点，主题展示位零改动 |
| `pages/api/stats.js` | 新增：Umami 统计代理，服务端持 token 调 API，内存缓存 10 分钟 |
| `components/ExternalPlugins.js` | 接入 Umami，与 busuanzi 二选一 |
| `themes/heo/components/PostHeader.js` | 阅读量展示开关兼容 Umami |
| `docker-compose.umami.yml` | 新增：Umami + PostgreSQL 部署编排（仅监听本机，反代加 TLS） |
| `docs/umami-setup.md` | 新增：部署、配置、验证、备份全流程 |

### 1.2 Pagefind 本地搜索（替代 Algolia）

| 文件 | 变更 |
|---|---|
| `scripts/build-search-index.js` | 新增：构建后启动服务 → 读 sitemap → 并发抓取 HTML（顺带预热 ISR）→ 生成索引 |
| `components/PagefindSearchModal.js` | 新增：搜索弹窗，保留原快捷键/键盘导航交互，索引按需加载不进主 bundle |
| `themes/heo/components/SearchButton.js` | 切换到 Pagefind 弹窗 |
| `themes/heo/components/SearchResultsPagefind.js` | 新增：/search 页的客户端结果列表 |
| `themes/heo/index.js` | `LayoutSearch` 搜索分支改用 Pagefind 结果 |
| `pages/search/index.js`、`pages/search/[keyword]/index.js` | 不再把全站文章塞进 props，服务端只提供布局数据 |
| `components/AlgoliaSearchModal.js`、`lib/plugins/algolia.js` | 删除 |
| `conf/plugin.config.js`、`lib/utils/post.js`、`pages/index.js`、`lib/config/env-validation.js`、`package.json` | 清理 Algolia 全部引用与依赖 |

### 1.3 动态 OG 分享卡

| 文件 | 变更 |
|---|---|
| `pages/api/og.js` | 新增：`next/og` 生成 1200×630 卡片，参数长度限制 + 内存缓存 + 长 HTTP 缓存。2026-11-02 补齐计划 4.3 的 HMAC 防滥用：配 `OG_SIGN_KEY` 后未签名/签名错误请求 302 兜底图，未配则端点开放 |
| `lib/og/sign.js` | 新增：签名口径（除 sign 外参数按 key 排序、`k=v` 逐行 join、HMAC-SHA256 hex）；SEO.js 签名用 Node crypto，og.js 验签用 Edge Web Crypto，两端口径一致（有单测与对拍验证） |
| `public/fonts/og-title.ttf` | 新增：子集化 Noto Sans SC（780KB，GB2312 一级字 + ASCII + 标点） |
| `scripts/build-og-font.sh` | 新增：字体子集化脚本（需扩充字符集时重跑） |
| `components/SEO.js` | 文章页 og:image 指向动态端点；og:image 统一转绝对地址 |

### 1.4 客户端 JS 减负

| 文件 | 变更 |
|---|---|
| `components/NotionPage.js` | medium-zoom 改动态导入；移除 katex CSS 全局引入 |
| `components/Equation.js` | katex CSS 移入（仅在公式组件加载时生效） |
| `components/FacebookPage.js`、`themes/heo/components/SideRight.js` | 移除未启用的 Facebook 挂件及其依赖 |

### 1.5 细节清理

| 文件 | 变更 |
|---|---|
| `next.config.js` | 新增 CSP `Report-Only` 头（观察模式），支持 `CSP_REPORT_URI` |
| `next-sitemap` | 1.9.12 → 4.2.x（lockfile 已同步） |
| `.github/workflows/lighthouse.yml` | 新增：PR 触发的性能门禁（构建 → 索引 → LHCI） |
| `lighthouserc.js` | 适配 Lighthouse 12（移除已废弃的 PWA 类别与本地不适用的 http2 断言） |
| `Dockerfile` | 构建阶段生成 Pagefind 索引（失败不阻断镜像） |
| `.gitignore`、`.env.example` | 索引/快照目录忽略；新环境变量说明 |

---

## 二、上线前需要你配置的环境变量

```ini
# Umami（必须先部署实例，见 docs/umami-setup.md）
NEXT_PUBLIC_UMAMI_HOST=https://umami.你的域名
NEXT_PUBLIC_UMAMI_ID=<Website ID>
UMAMI_API_TOKEN=<API Key，服务端专用>

# 可选
UMAMI_STATS_SINCE=1577836800000
CSP_REPORT_URI=            # 留空则只在浏览器控制台输出违规日志
```

未配置 Umami 时：脚本不注入、阅读数不显示、`/api/stats` 返回 204，页面无报错。

### ⚠️ 顺手发现的内容配置错误（建议立即修正）

实测文章页输出的 og:image 域名是 `https://preview.tangly1024.com`——**Notion 配置页里的 `LINK` 字段仍是模板默认值**。该值优先级高于 `blog.config.js` 的 `LINK`，会同时污染 canonical、og:url、结构化数据和本次新增的动态 OG 卡地址。

修正方式：打开 Notion 的站点配置页，把 `LINK` 改为 `https://www.junlin-233.top`。

---

## 三、部署与验证

### 构建产物变化

- `yarn build` 后再跑 `yarn build:search` 生成搜索索引（或用 `yarn build:full` 一步完成）
- Docker 构建已自动执行索引步骤；索引失败仅告警，站点仍可用（搜索会提示"索引未生成"）

### 验证清单

1. **Umami**：访问任意文章 → Umami 后台 Realtime 出现记录；文章页头部出现阅读量
2. **搜索**：`Ctrl+K` 弹窗输入中文关键词 → 有结果且高亮；`/search?keyword=xxx` 页面可正常出结果
3. **OG**：`curl -I "https://域名/api/og?title=测试"` 返回 `image/png`；分享到微信/Twitter 出现卡片
4. **JS 减负**：`yarn build` 输出的 First Load JS 表对比基线（见 `docs/perf-baseline.md`）
5. **CSP**：打开控制台观察 `Content-Security-Policy-Report-Only` 违规日志，一周无异常后把 `next.config.js` 里的 key 改为 `Content-Security-Policy` 转强制

---

## 四、未执行项与决策记录

**Clerk 未移除**（计划中标注为"条件性"）。核查结论：

- `middleware.ts` 仅在配置了 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 时启用 Clerk，否则走 `noAuthMiddleware`（内含 `UUID_REDIRECT` 短链逻辑）
- `_app.js` 中 `ClerkBoundary` 为动态导入且按环境变量条件渲染，未配置时不进入首屏 bundle
- 实际成本：middleware 边缘函数体积，**不影响用户首屏 JS**
- 风险：移除会连带 `/dashboard`、`/sign-in`、`/sign-up`、`pages/api/user.ts` 失效

**结论**：收益中等而风险明确，待确认 `/dashboard` 是否在用后再决定。若确认不用，按以下顺序移除：`_app.js` 的 ClerkBoundary 分支 → `middleware.ts` 重写（**务必保留 UUID_REDIRECT 逻辑**）→ 删除 sign-in/sign-up/auth/dashboard → 移除依赖。

---

## 五、已知限制

1. **Pagefind 索引覆盖**：抓取式索引依赖 sitemap 完整性；新文章在索引重建前搜不到（正常，重建即生效）
2. **OG 字体覆盖**：780KB 子集覆盖 GB2312 一级字；标题含生僻字会缺字，用 `scripts/build-og-font.sh` 扩充字符集重跑
3. **OG 卡片不含封面图**：为保证生成速度与稳定性采用纯排版设计
4. **构建耗时**：Notion 私有 API 单次响应 80–110 秒，整站构建 10–15 分钟（P3 内容管线后会降到分钟级）
5. **本地构建的环境注意**：本机若存在批量删除保护（如 safe-delete shim），`next build` 清理 `.next/export` 会被拦截；构建前先 `mv .next .next-old` 而不是让 Next 删除
