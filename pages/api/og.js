import { ImageResponse } from 'next/og'

/**
 * 动态 OG 分享卡
 * GET /api/og?title=文章标题&sub=摘要&tag=标签1,标签2&date=2026-11-01&site=站点名
 *
 * 设计取舍：
 * - Edge Runtime：ImageResponse 原生支持，字体走同源 fetch，无需 fs
 * - 纯排版卡片，不拉取封面图（生成快、无外部依赖、不受 Notion CDN 影响）
 * - 中文字体为子集化 Noto Sans SC（public/fonts/og-title.ttf ≈780KB），按 isolate 缓存
 * - 参数做长度限制，防止被当作任意内容渲染服务滥用
 */

export const config = {
  runtime: 'edge'
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
async function loadFont(reqUrl) {
  if (fontCache) return fontCache
  const fontUrl = new URL('/fonts/og-title.ttf', reqUrl)
  const res = await fetch(fontUrl)
  if (!res.ok) throw new Error(`字体加载失败: ${res.status}`)
  fontCache = await res.arrayBuffer()
  return fontCache
}

// ---- HMAC 验签（与 lib/og/sign.js 同口径：除 sign 外参数按 key 排序，"k=v" 逐行 join('\n')）----
async function hmacHex(message, key) {
  const enc = new TextEncoder()
  const keyData = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', keyData, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySignature(searchParams) {
  const key = process.env.OG_SIGN_KEY
  if (!key) return true // 未配 Key 时端点保持开放（本地 / 未配 Key 的部署）
  const provided = (searchParams.get('sign') || '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(provided)) return false
  const entries = []
  for (const [k, v] of searchParams.entries()) {
    if (k !== 'sign' && v !== '') entries.push([k, v])
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const expected = await hmacHex(
    entries.map(([k, v]) => `${k}=${v}`).join('\n'),
    key
  )
  return provided === expected
}

const fallbackResponse = () =>
  new Response(null, {
    status: 302,
    headers: { Location: '/bg_image.jpg' }
  })

// 同一 isolate 内缓存已生成的图，key -> ArrayBuffer
const imageCache = new Map()

export default async function handler(req) {
  const { searchParams } = new URL(req.url)

  // 配了 OG_SIGN_KEY 时，未签名或签名错误的请求一律走兜底图
  if (!(await verifySignature(searchParams))) {
    return fallbackResponse()
  }

  const title = clamp(searchParams.get('title'), 60) || 'junlin 的博客'
  const sub = clamp(searchParams.get('sub'), 90)
  const tags = clamp(searchParams.get('tag'), 60)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 3)
  const date = clamp(searchParams.get('date'), 12)
  const siteName =
    clamp(searchParams.get('site'), 24) ||
    process.env.NEXT_PUBLIC_TITLE ||
    'junlin 的博客'
  const domain = (process.env.NEXT_PUBLIC_LINK || 'https://www.junlin-233.top')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

  const cacheKey = JSON.stringify([title, sub, tags, date, siteName])
  const headers = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable'
  }

  const cached = imageCache.get(cacheKey)
  if (cached) {
    return new Response(cached, { headers })
  }

  try {
    const fontData = await loadFont(req.url)

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

    const buffer = await image.arrayBuffer()

    if (imageCache.size >= CACHE_LIMIT) {
      imageCache.clear()
    }
    imageCache.set(cacheKey, buffer)

    return new Response(buffer, { headers })
  } catch (e) {
    console.warn('[api/og] 生成失败:', e?.message || e)
    return fallbackResponse()
  }
}
