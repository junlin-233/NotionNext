# P2 交付说明（韧性地基）· 进行中

> 更新日期：2026-11-02 ｜ 对应计划：`UPGRADE_PLAN.md` 第五节

---

## 一、已完成

### 1.1 Notion 快照降级层（计划 5.1）

| 文件 | 变更 |
|---|---|
| `lib/cache/snapshot_store.js` | 新增：一个 key 一个文件的快照存储，无 TTL、带版本号与 `savedAt`，写入走临时文件 + rename |
| `lib/cache/cache_manager.js` | 真实拉取成功才写快照；拉取抛异常、返回 `null`、返回空对象 `{}` 三种情况都降级读快照；新增 `isUsableData` 拦截空壳，避免空站点被写进缓存链 |
| `pages/api/status.js` | 新增：输出 `degraded` 与快照计数，供拨测告警 |
| `Dockerfile` | builder 阶段建 `.snapshot` 目录，runner 阶段带入，运行时才有兜底数据 |

要点：

- 快照与 FileCache 并存，职责不同：FileCache 有 TTL、只在构建期命中；快照无 TTL、只在故障时读。
- 快照读取后会回写常规缓存，避免每次请求都走降级路径。
- 只读文件系统（Vercel 类环境）下写入失败仅告警，不影响主流程。
- 快照目录 `.snapshot/` 已在 `.gitignore`。

### 1.2 `.notion-api-lock` 多进程卡死（P0 遗留的强制动作）

| 文件 | 变更 |
|---|---|
| `lib/db/notion/RateLimiter.ts` | 锁文件按进程隔离；陈旧锁在等待过程中重新判定；等锁超时（60s）或锁不可写时放行而非死等；只有真正拿到锁才释放，不会误删别人的锁 |
| `lib/db/notion/getNotionAPI.js` | 锁路径改为 `.notion-api-lock.<pid>` |

原问题有三处：多 worker 抢同一个锁文件互相等待；陈旧锁只在第一次获取时判定，前一个进程被 kill 后永久排队；`finally` 里无条件 `releaseLock`，可能删掉别的进程的锁。

### 1.3 统计数据源：Umami 取消，改 Cloudflare Web Analytics

Umami 官方云付费、自托管要养 Postgres，不用了。**注意：线上跑在 Vercel Hobby，没有 access log 可读**（log drain 要 Pro），所以主路径改成 Cloudflare Web Analytics（域名 DNS 已在 CF，免费、有 GraphQL API）；访问日志解析器保留，迁 VPS 时直接可用。接口三源降级：Umami → Cloudflare → 日志文件 → 204。

| 文件 | 变更 |
|---|---|
| `scripts/analytics/parse-access-log.js` | 新增：解析 combined / JSON 行日志，支持 gz 轮转；过滤静态资源、爬虫、非 2xx；按天聚出 PV/UV、页面 PV、Top 50 |
| `lib/analytics/local-stats.js` | 新增：读统计 JSON，按 mtime 缓存 5 分钟，文件缺失或开关关闭时返回 null |
| `lib/analytics/cloudflare.js` | 新增：GraphQL 取 `rumPageloadEventsAdaptiveGroups`，映射成统一 stats 结构，10 分钟进程内缓存 |
| `pages/api/stats.js` | Umami → Cloudflare → 日志统计 → 204 四级降级，返回结构不变 |
| `components/ViewStats.js` | 替换 `UmamiAnalytics.js`：只回填阅读数 DOM，不再注入跟踪脚本 |
| `components/ExternalPlugins.js` | 挂载条件改为「配了 Umami 或开启统计」 |
| `conf/analytics.config.js`、`.env.example`、`docs/analytics-setup.md` | 新增 `ANALYTICS_STATS_ENABLE` / `ANALYTICS_STATS_FILE`，附接入与验证步骤 |

前端契约没变（仍是 `.busuanzi_value_*` 那批节点），主题组件零改动。

### 1.4 回滚点补齐

`pre-upgrade-2026.11` 之前不存在（文档写了但没建），已补在 P1 之前的 `a265fd9b` 并推到远端。

---

## 二、验收

| 项 | 结果 |
|---|---|
| 新增用例 | `__tests__/lib/cache/snapshot.test.js`（8）、`__tests__/lib/db/rateLimiter.test.js`（4） |
| 全量测试 | 5 个 suite / 51 个用例全绿 |
| lint / tsc | 本批文件无告警，类型检查无相关报错 |
| 断网演练 | **本机做不了**，见下 |

### 断网演练怎么做（CI 或 Docker 环境）

本机建不成 `.next`（沙箱文件守卫拦截 `mkdir`/批量删除，`next dev` 与 `next build` 均失败），演练必须换环境：

```bash
# 1) 正常构建一次，产出快照
docker build -t nn-snap .

# 2) 起容器，把 Notion API 指向死端口
docker run -p 3000:3000 -e API_BASE_URL=http://127.0.0.1:9/api/v3 nn-snap

# 3) 访问首页：内容应正常渲染
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/api/status   # degraded:true，files>0
```

判断标准：首页 200 且文章列表非空、`/api/status` 报 `degraded: true`；日志出现 `[Cache][SNAPSHOT] 降级读取快照`。

---

## 三、未完成

| 计划项 | 状态 | 卡点 |
|---|---|---|
| 5.2 图片自托管第一步（`NOTION_HOST` 反代） | 未开始 | 需要一台挂反代的机器（Nginx / Edge Function）+ 域名，本机无 Docker |
| 5.3 客户端 JS 减负第二批 | 未开始 | 改动量在 `NotionPage.js` 与 heo 首屏组件，但本机无法构建，改了也没法对比 First Load JS |
| P0.1 / P0.2 基线数字 | 仍未补齐 | `lighthouse.yml` 只挂 PR 触发，实际都是直推 main，从未跑过；需手动触发一次 |
| Cloudflare 统计接入 | 代码已就绪，未配 token | 需在 CF 开 Web Analytics + 建 API Token，再配 3 个 Vercel 环境变量，见 `docs/analytics-setup.md` |
| Notion `LINK` 字段 | 未修 | 仍是模板域名，污染 canonical / og:url / 动态 OG 卡 |
