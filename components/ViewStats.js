import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

/**
 * 阅读量 / 访问量展示
 *
 * 数据来自 /api/stats（优先 Umami，其次访问日志统计），
 * 兼容 busuanzi 的 DOM 契约：回填 .busuanzi_value_{page_pv,site_pv,site_uv}
 * 并解除 .busuanzi_container_* 的 hidden 状态，主题组件无需改动。
 */
export default function ViewStats() {
  const router = useRouter()

  useEffect(() => {
    // 与 busuanzi 并存时，页面上的数字交给 busuanzi，避免两边抢写同一批节点
    if (siteConfig('ANALYTICS_BUSUANZI_ENABLE')) {
      return undefined
    }

    let cancelled = false

    const fillStats = async () => {
      try {
        const res = await fetch(
          `/api/stats?path=${encodeURIComponent(router.asPath)}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data) return

        const set = (cls, value) => {
          if (value === null || value === undefined) return
          document.querySelectorAll(`.busuanzi_value_${cls}`).forEach(el => {
            el.innerHTML = value
          })
          document
            .querySelectorAll(`.busuanzi_container_${cls}`)
            .forEach(el => el.classList.remove('hidden'))
        }

        set('page_pv', data.pagePv)
        set('site_pv', data.sitePv)
        set('site_uv', data.siteUv)
      } catch (e) {
        // 静默失败：统计不可用不影响页面内容
      }
    }

    const timer = setTimeout(() => {
      void fillStats()
    }, 800)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [router.asPath])

  return null
}
