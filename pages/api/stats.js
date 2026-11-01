import BLOG from '@/blog.config'

/**
 * Umami 统计代理接口
 * GET /api/stats?path=/article/xxx
 * 返回 { pagePv, sitePv, siteUv }
 *
 * - 服务端持 UMAMI_API_TOKEN 调用 Umami API，token 不暴露给客户端
 * - 内存缓存 10 分钟，避免高频触发 Umami 限流
 * - 未配置 Umami 时返回 204，前端静默忽略
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

  const { UMAMI_HOST, UMAMI_ID, UMAMI_API_TOKEN, UMAMI_STATS_SINCE } = BLOG
  if (!UMAMI_HOST || !UMAMI_ID || !UMAMI_API_TOKEN) {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).end()
    return
  }

  const path = (req.query.path || '/').split('?')[0]
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
    // Umami 不可用时返回 204，页面上的计数保持上一次成功值或隐藏
    console.warn('[api/stats] Umami 请求失败:', e.message)
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
