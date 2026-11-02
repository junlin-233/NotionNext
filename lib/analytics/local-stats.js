import fs from 'fs'
import path from 'path'
import BLOG from '@/blog.config'

/**
 * 读取访问日志统计结果（由 scripts/analytics/parse-access-log.js 生成）
 *
 * 文件不存在、损坏、或统计开关关闭时返回 null，调用方静默降级。
 * 用 mtime 做缓存，统计文件更新后下一次请求即生效，不需要重启。
 */

const CACHE_TTL_MS = 5 * 60 * 1000

let cache = { data: null, mtime: 0, loadedAt: 0 }
let lastWarnAt = 0

export function getStatsFilePath() {
  return BLOG.ANALYTICS_STATS_FILE
    ? path.resolve(BLOG.ANALYTICS_STATS_FILE)
    : path.resolve(process.cwd(), '.analytics', 'stats.json')
}

export function getLocalStats() {
  if (!BLOG.ANALYTICS_STATS_ENABLE) return null

  const file = getStatsFilePath()

  try {
    const stat = fs.statSync(file)
    const now = Date.now()

    if (
      cache.data &&
      cache.mtime === stat.mtimeMs &&
      now - cache.loadedAt < CACHE_TTL_MS
    ) {
      return cache.data
    }

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    cache = { data: parsed, mtime: stat.mtimeMs, loadedAt: now }
    return parsed
  } catch (e) {
    // 每分钟最多告警一次，避免日志刷屏
    if (Date.now() - lastWarnAt > 60 * 1000) {
      lastWarnAt = Date.now()
      console.warn(`[stats] 读取统计文件失败 ${file}: ${e.message}`)
    }
    return null
  }
}

/**
 * 把 asPath 归一成统计文件里的 key 口径：
 * 去 query、去 hash、去末尾斜杠
 */
export function normalizeStatsPath(asPath) {
  let p = (asPath || '/').split('?')[0].split('#')[0]
  if (!p.startsWith('/')) p = `/${p}`
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

export function getPageStats(asPath) {
  const stats = getLocalStats()
  if (!stats) return null

  const key = normalizeStatsPath(asPath)
  return {
    pagePv: stats.pages?.[key] ?? null,
    sitePv: stats.totals?.pv ?? null,
    siteUv: stats.totals?.uv ?? null,
    generatedAt: stats.generatedAt ?? null
  }
}

const localStats = {
  getLocalStats,
  getPageStats,
  normalizeStatsPath,
  getStatsFilePath
}

export default localStats
