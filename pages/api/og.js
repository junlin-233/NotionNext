import { verifyOgParams } from '@/lib/og/sign'
import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

/**
 * 动态 OG 分享卡
 * GET /api/og?title=文章标题&sub=摘要&tag=标签1,标签2&date=2026-11-01&site=站点名&sign=HMAC签名
 *
 * 设计取舍：
 * - Node Runtime（默认）：原 Edge Runtime 在 Vercel 的新函数平台上抛
 *   "Invalid URL string"（next-url.js 适配层，发生在进 handler 前），改走 Node
 * - 纯排版卡片，不拉取封面图（生成快、无外部依赖、不受 Notion CDN 影响）
 * - 中文字体为子集化 Noto Sans SC（public/fonts/og-title.ttf ≈780KB），按 isolate 缓存
 * - 参数做长度限制，防止被当作任意内容渲染服务滥用
 * - 配 OG_SIGN_KEY 时强制 HMAC 验签，未签名请求 302 兜底图
 */

export const config = {
  maxDuration: 30
}

const WIDTH = 1200
const HEIGHT = 630
const CACHE_LIMIT = 200

const clamp = (value, max) => {
  if (!value) return ''
  const str = String(value)
  return str.length > max ? `${str.slice(0, max)}…` : str
}

let fontCache = null
function loadFont() {
  if (fontCache) return fontCache
  fontCache = fs.readFileSync(
    path.join(process.cwd(), 'public', 'fonts', 'og-title.ttf')
  )
  return fontCache
}

// 同一 isolate 内缓存已生成的图，key -> ArrayBuffer
const imageCache = new Map()

export default async function handler(req, res) {
  // 配了 OG_SIGN_KEY 时，未签名或签名错误的请求一律走兜底图
  if (!verifyOgParams(req.query || {})) {
    res.redirect(302, '/bg_image.jpg')
    return
  }

  const title = clamp(req.query.title, 60) || 'junlin 的博客'
  const sub = clamp(req.query.sub, 90)
  const tags = clamp(req.query.tag, 60)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 3)
  const date = clamp(req.query.date, 12)
  const siteName =
    clamp(req.query.site, 24) ||
    process.env.NEXT_PUBLIC_TITLE ||
    'junlin 的博客'
  const domain = (process.env.NEXT_PUBLIC_LINK || 'https://www.junlin-233.top')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

  const cacheKey = JSON.stringify([title, sub, tags, date, siteName])
  res.setHeader('Content-Type', 'image/png')
  res.setHeader(
    'Cache-Control',
    'public, max-age=86400, s-maxage=31536000, immutable'
  )

  const cached = imageCache.get(cacheKey)
  if (cached) {
    res.status(200).end(cached)
    return
  }

  try {
    const fontData = loadFont()

    const image = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            padding: '64px 72px',
            position: 'relative'
          }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 12,
                height: 48,
                backgroundColor: '#2563eb',
                borderRadius: 6,
                marginRight: 20
              }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                fontWeight: 500,
                color: '#0f172a'
              }}>
              {siteName}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 24,
              marginBottom: 24
            }}>
            <div
              style={{
                display: 'flex',
                fontSize: title.length > 28 ? 58 : 68,
                lineHeight: 1.25,
                fontWeight: 500,
                color: '#0f172a',
                letterSpacing: '-0.02em'
              }}>
              {title}
            </div>
            {sub && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 28,
                  lineHeight: 1.5,
                  color: '#64748b',
                  marginTop: 24
                }}>
                {sub}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {tags.map(tag => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    color: '#2563eb',
                    backgroundColor: '#eff6ff',
                    padding: '8px 20px',
                    borderRadius: 999
                  }}>
                  #{tag}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                color: '#94a3b8'
              }}>
              {date ? `${date} · ` : ''}
              {domain}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: -80,
              bottom: -120,
              width: 380,
              height: 380,
              borderRadius: 999,
              backgroundColor: '#e2e8f0',
              opacity: 0.5,
              display: 'flex'
            }}
          />
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 500,
            style: 'normal'
          }
        ]
      }
    )

    const buffer = Buffer.from(await image.arrayBuffer())

    if (imageCache.size >= CACHE_LIMIT) {
      imageCache.clear()
    }
    imageCache.set(cacheKey, buffer)

    res.status(200).end(buffer)
  } catch (e) {
    console.warn('[api/og] 生成失败:', e?.message || e)
    res.redirect(302, '/bg_image.jpg')
  }
}
