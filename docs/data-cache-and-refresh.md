# 缓存与刷新口径：改完页面多久生效

> 2026-11-03 ｜ 线上 Vercel，`CONTENT_SOURCE=git`，站点数据来自 `content/`

## 一、结论

**部署完成不等于数据生效。** 2026-11-03 实测：首次部署后 `buildId` 已经更新、UI 改动都出来了，但「最新发布」的数据还是上一版，十几分钟后再部署一次才对上。

所以改数据层的东西，别拿"我刚部署过"当验收依据。页面最长的陈旧窗口是 `NEXT_REVALIDATE_SECOND`（git 内容源默认 3600 秒）。

## 二、缓存有几层

| 层 | 什么时候用 | 存在哪 | 有效期 |
| --- | --- | --- | --- |
| 页面 ISR | 每次页面请求 | Vercel | `NEXT_REVALIDATE_SECOND`：git 源 3600s、notion 源 600s。重新部署不保证清掉 |
| 站点数据缓存（构建期） | `npm run build` | `data.json`（已在 .gitignore，Vercel 构建机上没有）+ memory | 文件不存在即 miss，线上等于没有 |
| 站点数据缓存（运行时） | 仅 `ENABLE_CACHE=true` 时 | redis（配了 `REDIS_URL`）/ memory | `NEXT_REVALIDATE_SECOND × 1.5` |
| 快照降级 | 拉 Notion 失败时 | `.snapshot/` | 无过期；`CONTENT_SOURCE=git` 时关闭 |

`ENABLE_CACHE` 默认只在构建期开（`npm_lifecycle_event === 'build'`），运行时默认关。所以线上决定新旧的是第一行的页面 ISR，不是数据缓存。

实际秒数以 Vercel 构建日志里的 `ISR: N Seconds` 为准，`/api/status` 可确认当前 `contentSource`。

## 三、哪些字段是派生数据

从 `allPages` 二次算出来的都算：

| 字段 | 怎么来的 |
| --- | --- |
| `latestPosts` | 过滤 Post + 排序 + 取前 6 |
| `tagOptions` / `categoryOptions` | 按 allPages 聚合计数 |
| `customNav` | 从 Page 列表生成导航 |
| `customMenu` | 菜单结构 |
| `allNavPages` | 过滤 + 补 href |
| `postCount` | 计数 |

这些在 `convertNotionToSiteData` 里算完，跟着整份站点数据一起进缓存。改了排序或筛选口径，缓存里还是上一版结果。

## 四、改动放哪

| 改动类型 | 放哪 | 生效方式 |
| --- | --- | --- |
| 派生逻辑（排序、筛选、聚合） | `handleDataBeforeReturn`，`fetchGlobalAllData` 每次调用都执行 | 请求期重算，缓存只留原始数据 |
| 原始拉取与解析（page properties、blockMap） | 留在 `convertNotionToSiteData` | 允许缓存，是净收益 |
| 纯 UI / 样式 | 随便改 | 部署即生效，不经过数据层 |

## 五、怎么验证

```bash
# 1. 本地按生产模式跑，不吃线上缓存
CONTENT_SOURCE=git npm run build
npx next start -p 3011
# 抓页面里 __NEXT_DATA__ 的 pageProps 对数据
```

2. 线上看响应头 `age`：小于 revalidate 值就是旧缓存，等它过期。
3. 别用 `_next/data/<buildId>/*.json` 判断新旧——它和页面共用同一份缓存，`?cb=` 也绕不过（Next 的 ISR 缓存按 pathname 存）。

## 六、一次真实的时间线：2026-11-03「最新发布」排序

| 时间 | 动作 | buildId | 线上顺序 | 观察 |
| --- | --- | --- | --- | --- |
| 16:07 | 提交排序修复（`getLatestPosts` 改按发布日期） | — | — | 代码层面正确 |
| 16:08 | 首次部署完成 | `yR8v6v04…` | 仍是旧顺序 | buildId 已更新，页面没重建 |
| 16:18 | 复查 | `yR8v6v04…` | 仍是旧顺序 | `age: 166` |
| 16:19 | 二次提交（派生数据挪到请求期算）并部署 | `AuT6dOdD…` | 顺序正确 | 这次页面重建了 |

两次之间既改了代码也重新部署，具体卡在哪一层从外部区分不出来（Vercel 的 ISR 缓存与数据缓存在部署时的行为没写进文档）。能确认的只有现象：**UI 立刻变了，数据没跟着变**。这正好说明 UI 走客户端渲染、数据走缓存的 pageProps，两者的生效路径不一样。

要看结果就按第五节本地跑，或者盯着 `age` 到过期。

## 七、想让发布更快生效

调 `NEXT_PUBLIC_REVALIDATE_SECOND`，它会同时改 ISR 和 redis TTL。600 秒 = 发布后最多 10 分钟生效，代价是回源频率高 6 倍。内容更新不频繁就保持 3600。
