# 访问日志统计接入（替代 Umami / busuanzi）

> 2026-11-02 ｜ 数据源：Nginx / 网关 access log ｜ 无需第三方服务、无月费

## 一、怎么工作

```
access.log ──[scripts/analytics/parse-access-log.js]──> .analytics/stats.json
                                                              │
                                             /api/stats 读取 ──┴──> 页面显示阅读数
```

- 解析脚本在**宿主机**跑（cron / systemd timer），只读日志、写一份 JSON。
- Next 容器通过 `ANALYTICS_STATS_FILE` 指向挂载进来的 JSON，接口 5 分钟粒度感知更新。
- 前端组件 `components/ViewStats.js` 回填原 busuanzi 的 DOM 节点，主题零改动。

## 二、日志格式要求

用 nginx 默认的 `combined` 即可，关键字段：`$remote_addr`、`$request`、`$status`、`$http_user_agent`。

```nginx
log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                '$status $body_bytes_sent "$http_referer" "$http_user_agent"';
access_log /var/log/nginx/access.log main;
```

缺 `$http_user_agent` 时爬虫过滤失效，统计量会虚高。网关/API 网关输出 JSON 行也能解析，字段名支持 `remote_addr|ip|client_ip`、`http_user_agent|ua`、`request_uri|uri|path`、`time_iso8601|time|timestamp`。

**用了 CDN 必须配真实 IP**，否则所有访问来自 CDN 节点，UV 直接失真：

```nginx
set_real_ip_from 0.0.0.0/0;      # 换成 CDN 回源段
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

## 三、接入步骤

```bash
# 1) 手动跑一次，确认口径
node scripts/analytics/parse-access-log.js \
  --log "/var/log/nginx/access.log*" \
  --out /opt/blog/.analytics/stats.json

# 输出示例：
# [stats] 4 个文件 / 1289043 行，计入 21338 次访问
# [stats] PV 21338 · UV 4127 · 页面 96 个
# [stats] 跳过：静态资源 1186421 · 爬虫 39118 · 非 2xx 2130 · 非 GET 44 · 无法解析 1923
```

口径自查：`计入` 应远小于总行数（静态资源占绝大多数）；`无法解析` 若超过 5%，说明日志格式不是 combined/json，需要调 `--format`。

```bash
# 2) cron：每小时更新一次
0 * * * * cd /opt/blog && /usr/bin/node scripts/analytics/parse-access-log.js \
  --log "/var/log/nginx/access.log*" --out /opt/blog/.analytics/stats.json --quiet

# 3) 容器挂载 + 环境变量
docker run -d ... \
  -e ANALYTICS_STATS_FILE=/app/.analytics/stats.json \
  -v /opt/blog/.analytics:/app/.analytics:ro \
  ghcr.io/junlin-233/notionnext:latest
```

`/var/log/nginx` 通常只有 root / adm 组可读，cron 跑在 root 下最省事；用普通用户时把该用户加进 `adm` 组。

## 四、验证

```bash
# 接口应返回真实数字，而不是 204
curl -s "https://www.junlin-233.top/api/stats?path=/article/notionnext"
# {"pagePv":42,"sitePv":21338,"siteUv":4127,"generatedAt":"2026-11-02T07:20:00.000Z"}

# 页面底部应出现访问量
curl -s https://www.junlin-233.top/ | grep -c busuanzi_container_site_pv
```

返回 204 表示统计文件没读到：先确认文件存在且容器内路径对得上，再看容器日志里的 `[stats] 读取统计文件失败`。

## 五、口径说明

| 指标 | 定义 |
|---|---|
| PV | 计入的有效请求数（2xx/3xx、GET/HEAD、非静态资源、非爬虫） |
| UV | 按 `sha256(盐 + IP + UA + 日期)` 前缀去重，跨天不累计，不落原始 IP |
| 页面 PV | 路径归一后的计数：去 query、去末尾斜杠、可剥站点子路径前缀 |
| 跳过 | 静态资源、UA 命中的爬虫、4xx/5xx、非 GET/HEAD、无法解析的行 |

爬虫名单在 `scripts/analytics/parse-access-log.js` 的 `BOT_UA` 常量里，误杀或漏杀改这一处。

## 六、和 P4 年度报告的关系

`stats.json` 里已经备好年度报告要的全部字段：`totals`、`daily`（按天 PV/UV）、`pages`（全站页面 × PV）、`top`（Top 50）。年度报告直接读这份文件即可，不需要再引数据源。

代价：**从现在开始跑才有数据**。日志被轮转删除的日期永远补不回来，建议 `logrotate` 保留 400 天以上。
