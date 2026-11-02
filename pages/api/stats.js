import BLOG from '@/blog.config'
import { getPageStats } from '@/lib/analytics/local-stats'
import {
  getCloudflarePageStats,
  isCloudflareConfigured
} from '@/lib/analytics/cloudflare'

/**
 * 站点统计接口
 * GET /api/stats?path=/article/xxx
 * 返回 { pagePv, sitePv, siteUv }
 *
 * 数据源优先级：
 * 1. Umami（配置了 HOST + ID + TOKEN 时）
 * 2. Cloudflare Web Analytics（配置了 token/account/siteTag 时，站点在 Vercel 的默认路径）
 * 3. 访问日志统计文件（自建 Nginx 时用 scripts/analytics/parse-access-log.js 生成）
 * 4. 都没有：204，前端静默隐藏
 *
 * 两种源的返回结构一致，前端组件无需区分。
 */

const CACHE_TTL_MS = 10 * 60 * 1000
const cache = new Map() // key -> { data, expireAt }

// 单进程内定期清理过期缓存，防止 Map 无限增长
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expireAt < now) cache.delete(key)
    }
  }, 30 * 60 * 1000)
  // Node 环境：不阻止进程退出
  if (timer.unref) timer.unref()
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=300')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).end()
    return
  }

  const path = (req.query.path || '/').split('?')[0]

  const { UMAMI_HOST, UMAMI_ID, UMAMI_API_TOKEN, UMAMI_STATS_SINCE } = BLOG
  if (UMAMI_HOST && UMAMI_ID && UMAMI_API_TOKEN) {
    return serveUmami({ res, path, UMAMI_HOST, UMAMI_ID, UMAMI_API_TOKEN, UMAMI_STATS_SINCE })
  }

  if (isCloudflareConfigured()) {
    const cf = await getCloudflarePageStats(path)
    if (cf) {
      res.status(200).json(cf)
      return
    }
  }

  // 无 Umami / Cloudflare 时走访问日志统计
  const local = getPageStats(path)
  if (!local) {
    res.status(204).end()
    return
  }
  res.status(200).json(local)
}

async function serveUmami({ res, path, UMAMI_HOST, UMAMI_ID, UMAMI_API_TOKEN, UMAMI_STATS_SINCE }) {
  const cacheKey = path
  const cached = cache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    res.status(200).json(cached.data)
    return
  }

  try {
    const data = await fetchUmamiStats({
      host: UMAMI_HOST.replace(/\/$/, ''),
      websiteId: UMAMI_ID,
      token: UMAMI_API_TOKEN,
      since: UMAMI_STATS_SINCE,
      path
    })

    cache.set(cacheKey, { data, expireAt: Date.now() + CACHE_TTL_MS })
    res.status(200).json(data)
  } catch (e) {
    // Umami 不可用时回落到日志统计，再不行返回 204
    console.warn('[api/stats] Umami 请求失败:', e.message)
    const local = getPageStats(path)
    if (local) {
      res.status(200).json(local)
      return
    }
    res.status(204).end()
  }
}

async function fetchUmamiStats({ host, websiteId, token, since, path }) {
  const startAt = Number(since) || 1577836800000
  const endAt = Date.now()
  const base = `${host}/api/websites/${websiteId}/stats`
  const headers = {
    Accept: 'application/json',
    // Umami v2 支持 Bearer token 与 x-umami-api-key 两种鉴权方式
    Authorization: `Bearer ${token}`,
    'x-umami-api-key': token
  }

  // 站点总量（无 url 过滤）
  const siteUrl = `${base}?startAt=${startAt}&endAt=${endAt}`
  // 单页阅读量（url 过滤）
  const pageUrl = `${base}?startAt=${startAt}&endAt=${endAt}&url=${encodeURIComponent(path)}`

  const [siteRes, pageRes] = await Promise.all([
    fetch(siteUrl, { headers }),
    fetch(pageUrl, { headers })
  ])

  let sitePv = null
  let siteUv = null
  let pagePv = null

  if (siteRes.ok) {
    const json = await siteRes.json()
    sitePv = json?.pageviews?.value ?? null
    siteUv = json?.visitors?.value ?? null
  }

  if (pageRes.ok) {
    const json = await pageRes.json()
    pagePv = json?.pageviews?.value ?? null
  }

  return { pagePv, sitePv, siteUv }
}
