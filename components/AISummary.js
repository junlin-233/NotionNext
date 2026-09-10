import styles from './AISummary.module.css'
import { useGlobal } from '@/lib/global'
import { useEffect, useState } from 'react'

const AISummary = ({ aiSummary }) => {
  const { locale } = useGlobal()
  const [summary, setSummary] = useState(aiSummary)

  useEffect(() => {
    setSummary(aiSummary)
    return animateAiSummary(aiSummary, setSummary)
  }, [aiSummary])

  return (
    aiSummary && (
      <div className={styles['post-ai']}>
        <div className={styles['ai-container']}>
          <div className={styles['ai-header']}>
            <div className={styles['ai-icon']}>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                width='24'
                height='24'>
                <path
                  fill='#ffffff'
                  d='M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z'
                />
              </svg>
            </div>
            <div className={styles['ai-title']}>{locale.AI_SUMMARY.NAME}</div>
            <div className={styles['ai-tag']}>GPT</div>
          </div>
          <div className={styles['ai-content']}>
            <div className={styles['ai-explanation']}>
              {summary}
              {summary !== aiSummary && (
                <span className={styles['blinking-cursor']}></span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  )
}

const animateAiSummary = (rawSummary, setSummary) => {
  if (!rawSummary) {
    return undefined
  }

  let currentIndex = 0
  let frameId
  let lastUpdateTime = performance.now()
  let animationRunning = true
  let observer

  const finish = () => {
    currentIndex = rawSummary.length
    setSummary(rawSummary)
  }

  const animate = currentTime => {
    if (!animationRunning) {
      frameId = undefined
      return
    }

    if (currentIndex >= rawSummary.length) {
      finish()
      frameId = undefined
      observer?.disconnect()
      return
    }

    // 一帧追加一小段文本，避免每个字符都触发一次 React 更新。
    if (currentTime - lastUpdateTime >= 42) {
      const nextIndex = Math.min(currentIndex + 3, rawSummary.length)
      setSummary(rawSummary.slice(0, nextIndex))
      currentIndex = nextIndex
      lastUpdateTime = currentTime
    }

    frameId = window.requestAnimationFrame(animate)
  }

  observer =
    typeof window !== 'undefined' && window.IntersectionObserver
      ? new IntersectionObserver(
          entries => {
            animationRunning = entries[0].isIntersecting
            if (
              animationRunning &&
              currentIndex < rawSummary.length &&
              !frameId
            ) {
              lastUpdateTime = performance.now()
              frameId = window.requestAnimationFrame(animate)
            }
          },
          { threshold: 0 }
        )
      : undefined

  const postAi = document.querySelector('.post-ai')
  if (!postAi) {
    finish()
    return undefined
  }

  observer?.observe(postAi)
  frameId = window.requestAnimationFrame(animate)

  return () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId)
    }
    observer?.disconnect()
  }
}

export default AISummary
