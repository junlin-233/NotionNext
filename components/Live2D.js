import { siteConfig } from '@/lib/config'
import { isMobile, loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'

/**
 * 网页动画
 * @returns
 */
export default function Live2D() {
  const showPet = siteConfig('WIDGET_PET')
  const petLink = siteConfig('WIDGET_PET_LINK')

  useEffect(() => {
    if (!showPet || isMobile() || window.__notionNextLive2DInitialized) {
      return
    }

    let timerId
    let cancelled = false
    const load = async () => {
      try {
        await loadExternalResource(
          'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/live2d.min.js',
          'js'
        )

        if (
          cancelled ||
          typeof window.loadlive2d !== 'function' ||
          !document.getElementById('live2d')
        ) {
          return
        }

        window.loadlive2d('live2d', petLink)
        window.__notionNextLive2DInitialized = true
      } catch (error) {
        console.error('读取PET模型', error)
      }
    }

    if ('requestIdleCallback' in window) {
      timerId = window.requestIdleCallback(
        () => {
          void load()
        },
        { timeout: 1500 }
      )
    } else {
      timerId = window.setTimeout(() => {
        void load()
      }, 1000)
    }

    return () => {
      cancelled = true
      if ('cancelIdleCallback' in window && typeof timerId === 'number') {
        window.cancelIdleCallback(timerId)
      } else {
        window.clearTimeout(timerId)
      }
    }
  }, [petLink, showPet])

  if (!showPet) {
    return <></>
  }

  return (
    <canvas
      id='live2d'
      width='280'
      height='250'
      className='cursor-grab'
      onMouseDown={e => e.target.classList.add('cursor-grabbing')}
      onMouseUp={e => e.target.classList.remove('cursor-grabbing')}
    />
  )
}
