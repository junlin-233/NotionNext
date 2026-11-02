/* eslint-disable no-restricted-globals */
/**
 * Service Worker（P4.3）
 *
 * 没有用 serwist：它要接 webpack 插件、生成 precache manifest，
 * 而这个站点的静态资源带 hash、内容页走 ISR，运行时缓存已经够用。
 * 手写的好处是零依赖、零构建步骤，改完直接生效。
 *
 * 缓存策略：
 *   /_next/static/*   cache-first（文件名带 hash，永久有效）
 *   /images, /icons   cache-first（自托管图片，本地内容不变）
 *   页面导航           stale-while-revalidate，页面进 pages 缓存 → 离线可读
 *   /api/*            只走网络，离线时返回 503 JSON
 *
 * 升级：改 VERSION 会清掉旧缓存；收到 SKIP_WAITING 消息立刻接管。
 */

const VERSION = 'v1'
const STATIC_CACHE = `nn-static-${VERSION}`
const PAGE_CACHE = `nn-pages-${VERSION}`
const IMAGE_CACHE = `nn-images-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then(cache => cache.addAll([OFFLINE_URL]))
      .catch(() => {})
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(
              key =>
                ![STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE].includes(key)
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|ttf|svg|png|jpe?g|webp|avif|ico)$/.test(url.pathname)
  )
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(PAGE_CACHE)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    // 后台更新，不阻塞本次渲染
    return cached
  }

  const fresh = await network
  if (fresh) return fresh

  const offline = await cache.match(OFFLINE_URL)
  if (offline) return offline
  return new Response('离线，且这篇还没缓存', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    // 动态接口离线时给个明确的失败，别让页面卡住
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  if (isStaticAsset(url)) {
    const cacheName = url.pathname.startsWith('/_next/static/')
      ? STATIC_CACHE
      : IMAGE_CACHE
    event.respondWith(cacheFirst(request, cacheName))
  }
})
