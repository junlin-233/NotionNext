import { siteConfig } from '@/lib/config'
import { isMobile, loadExternalResource } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

/**
 * 网页动画
 * @returns
 */
export default function Live2D() {
  const showPet = siteConfig('WIDGET_PET')
  const petLink = siteConfig('WIDGET_PET_LINK')
  const [shouldLoad, setShouldLoad] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!showPet || isMobile()) {
      return
    }

    if (!window.IntersectionObserver) {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px' }
    )

    if (canvasRef.current) {
      observer.observe(canvasRef.current)
    }

    return () => observer.disconnect()
  }, [showPet])

  useEffect(() => {
    if (
      !showPet ||
      !shouldLoad ||
      isMobile() ||
      initialized ||
      window.__notionNextLive2DInitialized
    ) {
      return
    }

    let cancelled = false
    let timerId
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const load = async () => {
      try {
        await loadExternalResource(
          'https://cdn.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/live2d.min.js',
          'js'
        )

        if (cancelled || typeof window.loadlive2d !== 'function' || !canvas) {
          return
        }

        window.loadlive2d('live2d', petLink)
        window.__notionNextLive2DInitialized = true
        setInitialized(true)
      } catch (error) {
        console.warn('读取PET模型失败', error)
      }
    }

    if ('requestIdleCallback' in window) {
      timerId = window.requestIdleCallback(() => void load(), {
        timeout: 1500
      })
    } else {
      timerId = window.setTimeout(() => void load(), 1000)
    }

    return () => {
      cancelled = true
      if ('cancelIdleCallback' in window && typeof timerId === 'number') {
        window.cancelIdleCallback(timerId)
      } else {
        window.clearTimeout(timerId)
      }
    }
  }, [initialized, petLink, shouldLoad, showPet])

  if (!showPet) {
    return <></>
  }

  return (
    <canvas
      id='live2d'
      ref={canvasRef}
      width='280'
      height='250'
      className='cursor-grab'
      aria-label='Live2D widget'
      onMouseDown={e => e.target.classList.add('cursor-grabbing')}
      onMouseUp={e => e.target.classList.remove('cursor-grabbing')}
    />
  )
}
