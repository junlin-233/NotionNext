# 站点统计方案（busuanzi 展示 + 定时归档历史）

> 2026-11-02 ｜ 站点在 Vercel Hobby，域名 DNS 在 Cloudflare

## 一、最终选型

| 需求 | 做法 |
|---|---|
| 页面上的阅读量 / 访问量 | **busuanzi**，前端脚本直接回填数字，零成本 |
| 历史数据（年度报告要用） | **每天抓一次 busuanzi 累计值**，存 `analytics/history.json`，相邻两天相减得日增 |
| 以后换数据源 | 代码里保留 Cloudflare 与访问日志两条路，接口四级降级，前端不用改 |

被否掉的：Umami（付费或自养数据库）、Vercel Analytics（数据拿不出来）、Nginx 日志（Vercel 上没有 access log，log drain 要 Pro）。

## 二、页面展示：busuanzi

`conf/analytics.config.js` 里 `ANALYTICS_BUSUANZI_ENABLE` 默认 `true`，无需额外配置。前端由 `components/Busuanzi.js` 拉 `busuanzi.ibruce.info` 并回填 `.busuanzi_value_*` 节点，页脚和文章页的数字自动出现。

要关掉就设 `NEXT_PUBLIC_ANALYTICS_BUSUANZI_ENABLE=false`。CSP 已把 `busuanzi.ibruce.info` 加进 `script-src`。

## 三、历史归档：每天一次

```bash
npm run stats:archive
# [archive] 写入 analytics/history.json
# [archive] 2026-11-02 累计 PV 1319 / UV 898（首条记录，无增量）
# [archive] 共 1 天记录
```

GitHub Actions 每天 23:50（北京时间）自动跑，见 `.github/workflows/busuanzi-archive.yml`，也可手动触发。

产物结构：

```json
{
  "source": "busuanzi",
  "points": [
    { "date": "2026-11-02", "sitePv": 1319, "siteUv": 898, "pvDelta": null, "uvDelta": null },
    { "date": "2026-11-03", "sitePv": 1350, "siteUv": 903, "pvDelta": 31, "uvDelta": 5 }
  ]
}
```

- `sitePv` / `siteUv`：busuanzi 的累计值（只增不减）
- `pvDelta` / `uvDelta`：相邻两天相减，归档首日为空
- 同一天重复跑覆盖当天那条，取最后一次读数
- busuanzi 计数若被重置（累计值回退），增量按 0 记，不出现负数

### ⚠️ 抓取会污染一点数据，已压到最小

抓取本身就是一次访问，busuanzi 会记一笔：

- `site_pv` 每次 +1 → **每天 1 次，可忽略**
- `site_uv` 靠 cookie 去重 → 脚本固定发同一个 `busuanziId`，UV **不会**虚增（实测连打三次 site_uv 停在 898 不动）

所以：**不要提高抓取频率**。也**不做页面级 PV 归档**——每个页面抓一次就是 +1 PV，几百篇会把数据搅烂。代价是年度报告的「Top 10 文章」拿不到，只有站点总量趋势。

### 历史只能从今天起往后积累

busuanzi 不提供过去任何一天的明细，累计值也不可拆解。今天之前的数据拿不回来，第一条记录就是起点。中间断几天也补不回来，断的那段会并入下一次抓取的增量。

## 四、备用路径（当前不启用）

`/api/stats` 的降级链：Umami → Cloudflare → 访问日志文件 → 204。前两条要额外账号或机器，现在都没配，实际返回 204，页面数字由 busuanzi 负责。

- **换 Cloudflare Web Analytics**：CF 面板开 Web Analytics + 建 API Token + 配三个环境变量（见 `lib/analytics/cloudflare.js` 顶部注释）。优点是 PV/UV 是真实统计而非累计差分，还能拿页面级数据。
- **迁到自己的服务器**：`scripts/analytics/parse-access-log.js` 解析 nginx 日志，用法见脚本头部注释。

## 五、每天会多一次 Vercel 构建

归档 workflow 每天往 main 提交一次 `analytics/history.json`，会触发一次 Vercel 重新构建（免费，但耗时 10 分钟以上）。

嫌浪费的话，Vercel 项目设置 → Build and Deployment → **Ignored Build Step** 选「Only build if there are changes in a folder」，把 `analytics` 排除掉。不改也不影响正确性。
