import BLOG from '@/blog.config'

/**
 * PWA manifest
 * GET /api/manifest
 *
 * 走接口而不是放 public 静态文件，是为了让站名跟着 blog.config 走，
 * 不用在 manifest.json 里再抄一份品牌信息。
 */

export default function handler(req, res) {
  const author = BLOG.AUTHOR || 'NotionNext'
  const name = `${author} 的博客`

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    name,
    short_name: author,
    description: BLOG.BIO || '个人博客',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#c0392b',
    lang: BLOG.LANG || 'zh-CN',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  })
}
