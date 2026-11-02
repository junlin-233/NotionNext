import { Readable } from 'node:stream'
import { resolveProxyTarget } from '@/lib/db/notion/imageProxy'

/**
 * Notion 图片反代
 * GET /api/img?u=<encodeURIComponent(原始图片地址)>
 *
 * 目的：
 * 1. 把图片放到自己的域名下，带上 immutable 长缓存头，让 CDN 边缘缓存真正生效
 * 2. 白名单主机校验，避免被当成任意 URL 代理
 *
 * 回源失败时不报错，302 跳原始地址，页面照常显示图片。
 */

export const config = {
  api: {
    responseLimit: false
  }
}

const UPSTREAM_TIMEOUT = 10000

export default async function handler(req, res) {
  const target = resolveProxyTarget(req.query.u)

  if (!target) {
    res.status(400).json({ error: 'invalid image url' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT)

  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    })

    if (!upstream.ok || !upstream.body) {
      // Notion 签名过期（403）/ 上游 5xx：交给浏览器直连，别让图片挂掉
      res.setHeader('Cache-Control', 'no-store')
      res.redirect(302, target)
      return
    }

    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'image/jpeg'
    )
    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, s-maxage=31536000, immutable'
    )
    res.setHeader('X-Image-Source', 'notion-proxy')

    const length = upstream.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)

    Readable.fromWeb(upstream.body).pipe(res)
  } catch (error) {
    console.warn('[image-proxy] 回源失败，跳转原始地址:', error.message)
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, target)
  } finally {
    clearTimeout(timer)
  }
}
