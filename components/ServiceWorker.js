import { useEffect, useState } from 'react'

/**
 * Service Worker 注册与更新提示（P4.3）
 *
 * 生产环境才注册；local dev 上 SW 缓存会和 HMR 打架。
 * 有新版本时底部弹一条「新版本可用」，点了才 reload —— 不做强制刷新，
 * 避免用户正在读文章时页面突然跳走。
 */
const ServiceWorker = () => {
  const [waiting, setWaiting] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!('serviceWorker' in navigator)) return undefined
    if (process.env.NODE_ENV !== 'production') return undefined

    let disposed = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
        if (disposed) return

        if (registration.waiting) {
          setWaiting(registration.waiting)
          setVisible(true)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaiting(installing)
              setVisible(true)
            }
          })
        })
      } catch (error) {
        console.warn('[pwa] Service Worker 注册失败:', error.message)
      }
    }

    register()

    return () => {
      disposed = true
    }
  }, [])

  if (!visible || !waiting) return null

  return (
    <div className='fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg'>
      <span className='mr-3'>新版本可用</span>
      <button
        type='button'
        className='font-bold text-red-300'
        onClick={() => {
          waiting.postMessage('SKIP_WAITING')
          setVisible(false)
          window.location.reload()
        }}>
        刷新
      </button>
      <button
        type='button'
        className='ml-3 text-gray-400'
        onClick={() => setVisible(false)}>
        稍后
      </button>
    </div>
  )
}

export default ServiceWorker
