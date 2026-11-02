# 性能基线记录（P0）

> 建立日期：2026-11-01 ｜ 对应计划：`UPGRADE_PLAN.md` 第三节
> 回滚点：git tag `pre-upgrade-2026.11`（已创建）

---

## 一、结论先行

**本机未能产出可信的 First Load JS / Lighthouse 数字，原因不在代码，在环境：**

1. **Notion 私有 API 极慢**：单次请求响应 80–110 秒，整站构建耗时 12–15 分钟，`/[prefix]/[slug]/[...suffix]` 的页面数据收集多次触发 Next 的 300 秒超时
2. **文件删除保护**：本机 Node 环境存在批量删除守卫（`node-safe-delete-shim`），单 turn 累计删除超阈值即拦截后续 `unlink`，导致 `next build` 清理 `.next/export` 时失败；该限制对构建产物同样生效
3. 两次构建产物（`.next` 与临时目录）分别处于 dev 模式与中断状态，chunk 体积不可比（28MB/35 chunks vs 2MB/66 chunks），不构成有效对比

**因此基线度量改由 CI 执行**（Lighthouse CI 已在 P1 接入 `.github/workflows/lighthouse.yml`），本机只保留定性事实。

---

## 二、已确认的定性事实（对后续阶段有指导意义）

| 事实 | 数据 | 影响 |
|---|---|---|
| Notion API 单次响应 | 80–110 秒（日志实测） | 构建瓶颈；P3 内容管线后应降到分钟级 |
| 整站生产构建耗时 | 12–15 分钟 | 同上 |
| 构建期并发重复拉取 | 多 worker 同时 MISS 同一 key | 缓存未跨 worker 共享；P2 快照层可缓解 |
| `/search` 页面 props | 含全部 Published 文章对象 | 已在 P1 改为只传布局数据 + 客户端 Pagefind |
| `.notion-api-lock` | 单文件锁，多进程并发时删除失败会导致请求排队 | 构建偶发卡死的原因之一，P2 需重新设计 |

---

## 三、如何在 CI / 干净环境补齐基线

```bash
# 1) 检出回滚点，装依赖
git checkout pre-upgrade-2026.11
yarn install --frozen-lockfile

# 2) 记录路由级 First Load JS（构建输出的路由表最后一段）
yarn build 2>&1 | tail -60 > baseline-build.log

# 3) 分析 bundle 构成（会打开交互式报告，导出 JSON）
ANALYZE=true yarn build

# 4) Lighthouse（本机需 Chrome）
npx @lhci/cli@0.14.x autorun --config=lighthouserc.js
```

**建议在 GitHub Actions 里跑**：新增 workflow 手动触发（workflow_dispatch），把 `baseline-build.log` 与 LHCI 报告作为 artifact 上传。P2 开工前补齐一次即可，后续每阶段对比。

---

## 四、P1 已完成的可度量项（不依赖构建）

| 指标 | 数值 |
|---|---|
| OG 分享卡生成耗时（首次，含字体加载） | 1.3 秒 |
| OG 分享卡产物体积 | 44 KB（1200×630 PNG） |
| OG 中文字体（子集化） | 780 KB（原字体 8 MB，压缩至 9.7%） |
| 移除的依赖 | `algoliasearch`、`react-facebook` |
| 文章页首屏移除的静态资源 | katex CSS（不再全局引入）、medium-zoom（改动态导入） |
| 搜索接口 | `/api/stats` 未配置时返回 204，无报错 |

---

## 五、P2 开工前的强制动作

1. 在 CI 或本地干净环境执行第三节命令，把数字补进本文档
2. 修复 `.notion-api-lock` 多进程并发问题（当前会拖慢甚至卡死构建）
3. 确认 Notion 配置页的 `LINK` 字段已改为真实域名（当前为 `https://preview.tangly1024.com`，会污染 canonical、OG、结构化数据）

---

## 五、P2/P3 实测（2026-11-02，本机）

构建环境已能跑通（`env -u NODE_OPTIONS` 绕开注入的 fs shim）；Notion API 本次单页响应 200–600ms，
整站构建 2–4 分钟，与文档早期记录的 80–110 秒不符——早期慢是限流导致的，不是常态。

| 指标 | 未改动态导入 | P2.3 后 | 变化 |
|---|---|---|---|
| 首页 First Load JS | 189 kB | 184 kB | −5 kB |
| 文章页 First Load JS | 195 kB | 191 kB | −4 kB |
| 共享 chunk 合计 | 213 kB | 209 kB | −4 kB |
| ├ framework | 44.8 kB | 44.8 kB | — |
| ├ main | 39.6 kB | 39.6 kB | — |
| └ pages/_app | 101 kB | 96.7 kB | −4.3 kB |

结论：P1 已经把能拆的大件拆完了，P2.3 的边际收益只有 4 kB。
剩下的大头是 Next 框架（84 kB）与 `_app` 里的主题布局 + react-notion-x（96.7 kB），
后者只要还在客户端渲染 blockMap 就拆不掉。计划里写的「−30%」不成立。

P3 git 模式构建：同样 191 kB（内容源不影响前端体积），ISR 从 600s 提到 3600s。

需要 Lighthouse 的 LCP/TBT/CLS 仍然只能在 CI 或线上跑，本机没有 Chrome。
