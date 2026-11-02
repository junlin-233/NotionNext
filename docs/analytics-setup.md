# 站点统计接入（Cloudflare Web Analytics）

> 2026-11-02 ｜ 站点托管在 Vercel Hobby，域名 DNS 在 Cloudflare

## 一、为什么是这条路

先排掉走不通的：

| 方案 | 结论 |
|---|---|
| Umami | 官方云付费，自托管要养一套 Postgres，不划算 |
| Nginx access log | **不成立**：站点在 Vercel，Hobby 没有 log drain（要 Pro），压根拿不到原始访问日志 |
| Vercel Web Analytics | Hobby 免费额度小，面板看得到、长期导出受限 |
| busuanzi | 免费但只有当前 PV，无历史无 API，年度报告做不了 |
| **Cloudflare Web Analytics** | 域名 DNS 已在 CF；免费、无采样上限、有 GraphQL API，数据保留 6 个月 |

代码实现是**三源降级**，日志解析那条路没有白写——将来迁到自己的 VPS 时直接可用：

```
/api/stats
  ├─ 1. Umami（配了才用）
  ├─ 2. Cloudflare Web Analytics（当前线上走这条）
  ├─ 3. 访问日志统计文件（自建 Nginx 时用）
  └─ 4. 都没有 → 204，前端隐藏数字
```

## 二、你要做的两步

### 1. Cloudflare 开 Web Analytics

Cloudflare 面板 → **Analytics & Logs → Web Analytics → Add a site** → 填 `www.junlin-233.top` → 拿到 **JavaScript snippet token**（beacon token）。

站点没走 CF 代理（橘色云朵是灰的），所以 CF **不会自动注入**页面脚本。但不需要它注入——我们只拿 token 走 API 取数，页面上一行脚本都不用加。

顺手记下 **Account ID**（面板右侧栏，或 URL 里 `/accounts/<id>/`）。

### 2. 建一个有读权限的 API Token

Cloudflare 面板 → My Profile → **API Tokens → Create Token** → 自定义：

- 权限：`Account` → `Account Analytics` → **Read**
- 资源：你的账户

拿到 token 后，在 Vercel 项目里加三个环境变量（Production + Preview 都要）：

```ini
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_SITE_TAG=<Web Analytics 的 beacon token>
```

三个都配齐，`/api/stats` 才走 CF；少一个自动降级。

## 三、验证

```bash
# 配置齐全后应返回真实数字，而不是 204
curl -s "https://www.junlin-233.top/api/stats?path=/article/notionnext"
# {"pagePv":42,"sitePv":21338,"siteUv":4127,"generatedAt":"2026-11-02T08:00:00.000Z"}
```

- 返回 204 → 三个变量没配全，或 token 权限不对
- 返回数字但全 0 → Web Analytics 刚开、还没收到 beacon，等第一次真实访问后再看
- 接口自身缓存 10 分钟，CF 侧通常几分钟内可见

## 四、口径（和日志方案不同，必须知道）

| 指标 | Cloudflare 口径 |
|---|---|
| PV | `count`，一次页面加载算一次。只统计 HTML 页面，天然不含静态资源与爬虫 |
| UV | `sum.visits`，**会话数**。CF 不做独立访客去重，这是最接近的可比值，不是严格唯一用户 |
| 页面 PV | 按 `requestPath` 分组，最多取 500 个路径 |
| 抽样 | 7 天内原始数据；更早的聚合到约 10%，`source.sampleInterval` 给出当前查询的抽样粒度 |
| 保留 | **只有最近 6 个月** |

因为 6 个月这个硬限制，年度报告要留全年数据就得自己存档。解析器和统一结构都已备好：

```bash
node scripts/analytics/parse-access-log.js --log "/var/log/nginx/access.log*"
```

`stats.json` 结构（两种来源一致，靠 `source.provider` 区分）：

```json
{
  "totals": { "pv": 21338, "uv": 4127 },
  "daily": [{ "date": "2026-11-01", "pv": 120, "uv": 80 }],
  "pages": { "/article/notionnext": 42 },
  "top": [{ "path": "/article/notionnext", "pv": 42 }]
}
```

P4 年度报告直接读这份结构，不需要再引数据源。

## 五、备用：自建 Nginx 时怎么用日志

迁到自己机器后，CF 那三个变量不配，改用：

```ini
ANALYTICS_STATS_FILE=/app/.analytics/stats.json
ACCESS_LOG_PATH=/var/log/nginx/access.log
```

日志必须是 nginx 默认 `combined`（要带 `$http_user_agent`，否则爬虫过滤失效）。用了 CDN 还要配 `set_real_ip_from` + `real_ip_header`，否则 UV 会塌成个位数。

```bash
# 每小时更新
0 * * * * cd /opt/blog && node scripts/analytics/parse-access-log.js \
  --log "/var/log/nginx/access.log*" --out /opt/blog/.analytics/stats.json --quiet

# 容器挂载
docker run ... -e ANALYTICS_STATS_FILE=/app/.analytics/stats.json \
  -v /opt/blog/.analytics:/app/.analytics:ro ...
```

爬虫名单在 `scripts/analytics/parse-access-log.js` 的 `BOT_UA` 常量，误杀漏杀改这一处。
