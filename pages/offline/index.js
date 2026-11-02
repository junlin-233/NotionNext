import { useEffect, useState } from 'react'

/**
 * 离线页（P4.3）
 *
 * 服务端不缓存任何东西，页面本身由 Service Worker 预缓存。
 * 已缓存的文章从 Cache Storage 里读，标题从缓存的 HTML 里取 <title>，
 * 所以这里不需要额外的索引接口。
 */

const CACHE_NAME = 'nn-pages-v1'

const Offline = () => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const load = async () => {
      if (!('caches' in window)) {
        setLoading(false)
        return
      }
      try {
        const cache = await caches.open(CACHE_NAME)
        const requests = await cache.keys()
        const list = []
        for (const request of requests) {
          const url = new URL(request.url)
          if (url.pathname === '/offline') continue
          const response = await cache.match(request)
          if (!response) continue
          const html = await response.text()
          const title =
            (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || url.pathname
          list.push({ path: url.pathname, title })
        }
        setPosts(list)
      } catch (error) {
        console.warn('[offline] 读取缓存失败:', error.message)
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <div className='mx-auto w-full max-w-3xl px-5 py-10'>
      <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-100'>
        离线可读
      </h1>
      <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>
        {online
          ? '当前在线。下面是你访问过、已缓存到本机的文章。'
          : '当前断网，下面这些文章还能打开。'}
      </p>

      {loading && <p className='mt-6 text-sm text-gray-400'>读取缓存中…</p>}

      {!loading && posts.length === 0 && (
        <p className='mt-6 text-sm text-gray-400'>
          还没有缓存任何文章。联网时打开一篇，之后断网也能看。
        </p>
      )}

      <ul className='mt-6 space-y-2'>
        {posts.map(post => (
          <li key={post.path}>
            <a
              href={post.path}
              className='block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:border-red-400 hover:text-red-500 dark:border-gray-700 dark:text-gray-200'>
              {post.title}
            </a>
          </li>
        ))}
      </ul>

      <p className='mt-8 text-xs text-gray-400'>
        评论、AI 问答这类需要联网的功能，离线时不可用。
      </p>
    </div>
  )
}

export default Offline
