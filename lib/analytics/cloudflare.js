import BLOG from '@/blog.config'

/**
 * Cloudflare Web Analytics 取数（站点托管在 Vercel 时的默认数据源）
 *
 * 为什么用它：
 * - 站点在 Vercel Hobby，拿不到原始 access log（log drain 要 Pro）
 * - 域名 DNS 已在 Cloudflare，Web Analytics 免费、无采样上限、有 GraphQL API
 * - 数据保留 6 个月，年度报告需要更长历史时用 scripts/analytics/fetch-cloudflare.js 定期落盘
 *
 * 口径：
 * - pv  = count（beacon 命中数，一次页面加载算一次，本身不含静态资源与爬虫）
 * - uv  = sum.visits（会话数）。CF 不提供真正的独立访客去重，这是最接近的可用口径
 */

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'
const CACHE_TTL_MS = 10 * 60 * 1000

let cache = { data: null, at: 0 }
let lastWarnAt = 0

// 测试用：清掉进程内缓存
export function resetCacheForTest() {
  cache = { data: null, at: 0 }
}

export function isCloudflareConfigured() {
  return Boolean(
    BLOG.CLOUDFLARE_API_TOKEN &&
      BLOG.CLOUDFLARE_ACCOUNT_ID &&
      BLOG.CLOUDFLARE_SITE_TAG
  )
}

function isoDay(offsetDays) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  return d.toISOString().slice(0, 10)
}

function buildQuery() {
  return `query($accountTag: String!, $siteTag: String!, $from: String, $to: String) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        daily: rumPageloadEventsAdaptiveGroups(
          limit: 100
          filter: { siteTag: $siteTag, date_geq: $from, date_leq: $to }
          orderBy: [date_ASC]
        ) { count sum { visits } avg { sampleInterval } dimensions { date } }
        pages: rumPageloadEventsAdaptiveGroups(
          limit: 500
          filter: { siteTag: $siteTag, date_geq: $from, date_leq: $to }
          orderBy: [count_DESC]
        ) { count sum { visits } dimensions { requestPath } }
      }
    }
  }`
}

/**
 * 拉取最近 N 天的统计，返回与访问日志方案一致的 stats.json 结构
 */
export async function fetchCloudflareStats({ days = 30 } = {}) {
  if (!isCloudflareConfigured()) return null

  const now = Date.now()
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data

  const body = {
    query: buildQuery(),
    variables: {
      accountTag: BLOG.CLOUDFLARE_ACCOUNT_ID,
      siteTag: BLOG.CLOUDFLARE_SITE_TAG,
      from: isoDay(days),
      to: isoDay(0)
    }
  }

  let json
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BLOG.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  json = await res.json()

  // GraphQL 的鉴权/字段错误也是 200，必须显式检查 errors
  if (json?.errors?.length) {
    throw new Error(
      `Cloudflare GraphQL: ${json.errors.map(e => e.message).join('; ')}`
    )
  }

  const account = json?.data?.viewer?.accounts?.[0]
  if (!account) {
    throw new Error('Cloudflare GraphQL: 返回里没有 accounts，检查 accountTag 与 token 权限')
  }

  const stats = mapToStats(account, days)
  cache = { data: stats, at: now }
  return stats
}

/**
 * GraphQL 分组结果 -> 统一结构；纯函数，便于测试
 */
export function mapToStats(account, days = 30) {
  const dailyRows = account.daily || []
  const pageRows = account.pages || []

  const daily = dailyRows.map(row => ({
    date: row.dimensions?.date || '',
    pv: Number(row.count) || 0,
    uv: Number(row.sum?.visits) || 0
  }))

  let pv = 0
  let uv = 0
  let sampleInterval = 1
  for (const row of dailyRows) {
    pv += Number(row.count) || 0
    uv += Number(row.sum?.visits) || 0
    const interval = Number(row.avg?.sampleInterval)
    if (interval > 0 && interval < sampleInterval) sampleInterval = interval
  }

  const pages = {}
  for (const row of pageRows) {
    const path = row.dimensions?.requestPath
    if (!path) continue
    pages[path] = Number(row.count) || 0
  }

  const top = Object.entries(pages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([path, count]) => ({ path, pv: count }))

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'cloudflare-web-analytics',
      windowDays: days,
      // CF 会对历史数据做约 10% 抽样，sampleInterval 表示当前查询的抽样粒度
      sampleInterval
    },
    range: {
      from: daily[0]?.date || null,
      to: daily[daily.length - 1]?.date || null
    },
    totals: { pv, uv },
    daily,
    pages,
    top
  }
}

/**
 * 页面级数据，接口用
 */
export async function getCloudflarePageStats(asPath, days = 30) {
  const stats = await fetchCloudflareStats({ days }).catch(e => {
    if (Date.now() - lastWarnAt > 60 * 1000) {
      lastWarnAt = Date.now()
      console.warn('[stats] Cloudflare 取数失败:', e.message)
    }
    return null
  })
  if (!stats) return null

  let p = (asPath || '/').split('?')[0].split('#')[0]
  if (!p.startsWith('/')) p = `/${p}`
  if (p.length > 1) p = p.replace(/\/+$/, '')

  return {
    pagePv: stats.pages?.[p] ?? null,
    sitePv: stats.totals?.pv ?? null,
    siteUv: stats.totals?.uv ?? null,
    generatedAt: stats.generatedAt ?? null
  }
}

const cloudflareAnalytics = {
  fetchCloudflareStats,
  getCloudflarePageStats,
  isCloudflareConfigured,
  mapToStats
}

export default cloudflareAnalytics
