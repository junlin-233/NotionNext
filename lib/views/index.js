import BLOG from '@/blog.config'
import fs from 'fs'
import path from 'path'
import Redis from 'ioredis'

/**
 * 文章阅读量计数器
 *
 * 生产：Redis（Upstash / Vercel KV 都行，环境变量 REDIS_URL 或 KV_URL）
 * 开发（没配 Redis）：写到 .next/cache/heo-views.json，重启不清零，方便本地验证
 * 生产且没配 Redis：视为未启用，前端自动隐藏阅读数，不显示一堆 0
 */

const RANK_KEY = 'heo:pv:rank' // zset: slug -> 阅读量，用于排热门
const pvKey = slug => `heo:pv:${slug}`
const dedupeKey = (visitorId, slug) => `heo:pv:d:${visitorId}:${slug}`
const DEDUPE_TTL = 60 * 60 * 12 // 同一访客 12 小时内只算一次

const LOCAL_FILE = path.resolve('./.next/cache/heo-views.json')
const isDev = process.env.NODE_ENV !== 'production'

function getRedisUrl() {
  return BLOG.REDIS_URL || process.env.REDIS_URL || process.env.KV_URL || ''
}

let client = null

function getRedis() {
  const url = getRedisUrl()
  if (!url) return null
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 5000 })
    // 连接异常不要冒泡成未捕获异常，计数失败不该影响页面
    client.on('error', () => {})
  }
  return client
}

/** 本地文件兜底（仅开发环境） */
function readLocal() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'))
  } catch (e) {
    return { counts: {}, seen: {} }
  }
}

function writeLocal(data) {
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true })
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data))
  } catch (e) {
    // 本地文件写失败就算了，不影响页面
  }
}

export function isViewsEnabled() {
  return Boolean(getRedisUrl()) || isDev
}

/**
 * 记一次阅读
 * @param {string} slug 文章 slug
 * @param {string} visitorId 访客指纹（IP + UA 哈希），用于去重
 * @returns {Promise<number|null>} 记完之后的阅读量
 */
export async function recordView(slug, visitorId) {
  if (!slug) return null
  const redis = getRedis()

  if (!redis) {
    const data = readLocal()
    const seenKey = `${visitorId}:${slug}`
    if (!data.seen[seenKey]) {
      data.seen[seenKey] = Date.now()
      data.counts[slug] = (data.counts[slug] || 0) + 1
      writeLocal(data)
    }
    return data.counts[slug] || 0
  }

  try {
    // 同一访客同一篇，12 小时内不重复计数
    if (visitorId) {
      const first = await redis.set(
        dedupeKey(visitorId, slug),
        '1',
        'EX',
        DEDUPE_TTL,
        'NX'
      )
      if (!first) {
        return Number(await redis.get(pvKey(slug))) || 0
      }
    }
    const result = await redis
      .multi()
      .incr(pvKey(slug))
      .zincrby(RANK_KEY, 1, slug)
      .exec()
    return Number(result?.[0]?.[1]) || 0
  } catch (e) {
    return null
  }
}

/**
 * 批量取阅读量
 * @param {string[]} slugs
 * @returns {Promise<Object>} { slug: count }
 */
export async function getViews(slugs = []) {
  if (!slugs.length) return {}
  const redis = getRedis()

  if (!redis) {
    const data = readLocal()
    return Object.fromEntries(slugs.map(s => [s, data.counts[s] || 0]))
  }

  try {
    const values = await redis.mget(slugs.map(pvKey))
    return Object.fromEntries(slugs.map((s, i) => [s, Number(values[i]) || 0]))
  } catch (e) {
    return {}
  }
}

/**
 * 取阅读量排名
 * @param {number} limit
 * @returns {Promise<Array<{slug: string, count: number}>>}
 */
export async function getTopViews(limit = 30) {
  const redis = getRedis()

  if (!redis) {
    const data = readLocal()
    return Object.entries(data.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([slug, count]) => ({ slug, count }))
  }

  try {
    const flat = await redis.zrevrange(RANK_KEY, 0, limit - 1, 'WITHSCORES')
    const ranked = []
    for (let i = 0; i < flat.length; i += 2) {
      ranked.push({ slug: flat[i], count: Number(flat[i + 1]) })
    }
    return ranked
  } catch (e) {
    return []
  }
}
