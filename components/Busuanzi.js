import busuanzi from '@/lib/plugins/busuanzi'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

let path = ''

export default function Busuanzi() {
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = url => {
      if (url === path) {
        return
      }

      path = url
      busuanzi.fetch()
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    busuanzi.fetch()

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return null
}
