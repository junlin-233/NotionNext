# Umami 自托管统计接入指南

## 为什么

替代 busuanzi：数据归属自己、无第三方脚本不稳定问题、为后续「年度阅读报告」积累数据。

> **两条路径先选一条**
> - **Umami Cloud 免费版**：5 分钟上手，无需服务器。但免费计划**不提供 API Key** → 统计后台正常工作，「本文阅读量」数字无法展示。
> - **自建实例（Docker / Vercel + Neon）**：可以自建 API Key → 阅读量数字、年度报告数据都能用。
>
> 代码对两种模式都兼容：配了 `UMAMI_API_TOKEN` 才有阅读量数字，不配就只统计不展示，页面不会报错也不会留空白图标。

## 路径 A：Umami Cloud（最省事）

1. 打开 `https://cloud.umami.is` 注册
2. 添加 Website，域名填 `www.junlin-233.top`
3. 从后台拿到 Website ID（形如 `0754cfc7-91f0-49df-a245-a90d5cb3d33a`）
4. 在部署平台配置两项即可：

```ini
NEXT_PUBLIC_UMAMI_HOST=https://cloud.umami.is
NEXT_PUBLIC_UMAMI_ID=<Website ID>
```

不要配置 `UMAMI_API_TOKEN`——免费版拿不到，`/api/stats` 会返回 204，前端静默跳过阅读量。

## 路径 B：自建实例（需要 Docker 或 Vercel）

### B1. Docker

```bash
# 1. 准备环境变量（放在 docker-compose.umami.yml 同目录的 .env 里）
cat > .env <<'EOF'
UMAMI_DB_PASSWORD=改成强密码
UMAMI_APP_SECRET=改成随机长字符串
EOF

# 2. 启动
docker compose -f docker-compose.umami.yml up -d

# 3. Nginx 反代（示意，umami 只监听 127.0.0.1:3001）
# server {
#   server_name umami.junlin-233.top;
#   location / {
#     proxy_pass http://127.0.0.1:3001;
#     proxy_set_header Host $host;
#     proxy_set_header X-Forwarded-Proto $scheme;
#   }
# }
```

### B2. Vercel + Neon（无 Docker）

1. Vercel 新建项目 → 导入 `umami-software/umami`
2. 数据库选 Neon（免费 Postgres），按提示连接
3. 部署完成后绑定自己的子域名（如 `umami.junlin-233.top`）

首次访问 `https://umami.<域名>`，用默认账号 `admin/umami` 登录后**立即改密码**。

## 二、配置博客侧环境变量

在部署平台（或 `.env.local`）配置：

```ini
NEXT_PUBLIC_UMAMI_HOST=https://umami.junlin-233.top   # 实例地址，无末尾斜杠
NEXT_PUBLIC_UMAMI_ID=<Website ID>                     # Umami 后台添加 Website 后获得
UMAMI_API_TOKEN=<API Key>                             # 仅自建实例可用；Cloud 免费版留空
UMAMI_STATS_SINCE=1577836800000                       # 可选，统计起点时间戳
```

Umami 后台：添加 Website（域名填博客域名）→ 复制 Website ID → Settings → API Keys 创建（仅自建版可用）。

## 三、生效方式

- 脚本注入：`pages/_document.js`（配置了 HOST+ID 自动注入）
- PV 上报：`components/UmamiAnalytics.js`（路由切换自动 track）
- 阅读数展示：`/api/stats` 代理 Umami API，回填主题里的 `busuanzi_value_*` 节点——
  文章页阅读量（PostHeader）、页脚站点 PV/UV（Footer）、侧栏 UV（AnalyticsCard）
- busuanzi 已默认关闭

## 四、共存模式（Cloud 免费版的推荐用法）

Umami Cloud 免费版不提供 API Key，读不到数字。此时可以让两个统计并存，各司其职：

```ini
# Umami 负责：来源、设备、趋势、实时访客（后台看）
NEXT_PUBLIC_UMAMI_HOST=https://cloud.umami.is
NEXT_PUBLIC_UMAMI_ID=<Website ID>

# busuanzi 只负责：页面上的阅读量数字展示
NEXT_PUBLIC_ANALYTICS_BUSUANZI_ENABLE=true
```

职责边界（代码已处理）：

- `UmamiAnalytics` 检测到 busuanzi 开启时**不再回填数字**，避免两边抢写同一批 DOM 节点
- 数字节点默认带 `hidden`，busuanzi 拿到数据后才显示；busuanzi 失效时只是不显示，不会留空白图标
- Umami 的脚本注入与上报不受影响

缺点：busuanzi 本身不稳定（这正是要替换它的原因），它挂了数字不显示。若想彻底干净，改用自建实例（路径 B）并移除 busuanzi 开关。

## 五、验证

1. 打开博客任意文章，Umami 后台 Realtime 应出现访问记录
2. 文章页头部出现 🔥 阅读量数字（并存模式下由 busuanzi 提供，可能有 1-2 秒延迟）
3. `curl https://<博客域名>/api/stats?path=/` 返回 204（Cloud 免费版）或 JSON（自建+API Key）

## 六、数据备份（仅自建实例）

```bash
# cron 每日 3 点备份
0 3 * * * docker exec umami-db pg_dump -U umami umami | gzip > /backups/umami-$(date +\%F).sql.gz
```
