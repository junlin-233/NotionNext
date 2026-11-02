import crypto from 'crypto'
import { getViews, isViewsEnabled, recordView } from '@/lib/views'

/**
 * 文章阅读量接口
 * GET  /api/views?slugs=a,b   批量查
 * POST /api/views {slug, record} 记一次（record=false 时只查）
 */

// 爬虫、预渲染、命令行访问不算阅读
const BOT_UA =
  /bot|spider|crawl|slurp|bingpreview|headless|phantom|curl|wget|python-requests|axios/i

const SLUG_PATTERN = /^[\w\-./%\u4e00-\u9fa5]{1,120}$/

function getVisitorId(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.headers['x-real-ip'] || '') ||
    req.socket?.remoteAddress ||
    ''
  const ua = req.headers['user-agent'] || ''
  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}`)
    .digest('hex')
    .slice(0, 16)
}

export default async function handler(req, res) {
  if (!isViewsEnabled()) {
    return res.status(200).json({ enabled: false })
  }

  if (req.method === 'GET') {
    const slugs = (req.query.slugs || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s && SLUG_PATTERN.test(s))
      .slice(0, 100)
    const counts = await getViews(slugs)
    return res.status(200).json({ enabled: true, counts })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { slug, record = true } = req.body || {}
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return res.status(400).json({ message: 'Invalid slug' })
  }

  const ua = req.headers['user-agent'] || ''
  if (BOT_UA.test(ua)) {
    const counts = await getViews([slug])
    return res.status(200).json({ enabled: true, count: counts[slug] ?? 0 })
  }

  const count = record
    ? await recordView(slug, getVisitorId(req))
    : (await getViews([slug]))[slug] ?? 0

  // 计数结果允许被 CDN 缓存一小会儿，减少函数调用
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ enabled: true, count })
}
