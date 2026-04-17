import { useEffect } from 'react'
import { siteConfig } from '@/lib/config'

/**
 * 鎬ц兘鐩戞帶缁勪欢
 * 鐩戞帶Web Vitals鎸囨爣骞朵笂鎶?
 */
const PerformanceMonitor = () => {
  useEffect(() => {
    const enableWebVitals = siteConfig('ENABLE_WEB_VITALS', true)
    const budget = siteConfig('PERFORMANCE_BUDGET', {
      FCP: 1800,
      LCP: 2500,
      FID: 100,
      CLS: 0.1
    })

    if (!enableWebVitals || typeof window === 'undefined') {
      return
    }

    const reportWebVitals = metric => {
      const { name, value, id } = metric
      let isOverBudget = false

      switch (name) {
        case 'FCP':
          isOverBudget = value > budget.FCP
          break
        case 'LCP':
          isOverBudget = value > budget.LCP
          break
        case 'FID':
          isOverBudget = value > budget.FID
          break
        case 'CLS':
          isOverBudget = value > budget.CLS
          break
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Performance] ${name}: ${value}${isOverBudget ? ' Over Budget' : ' OK'}`
        )
      }

      if (window.gtag) {
        window.gtag('event', name, {
          event_category: 'Web Vitals',
          event_label: id,
          value: Math.round(name === 'CLS' ? value * 1000 : value),
          non_interaction: true
        })
      }
    }

    import('web-vitals')
      .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(reportWebVitals)
        getFID(reportWebVitals)
        getFCP(reportWebVitals)
        getLCP(reportWebVitals)
        getTTFB(reportWebVitals)
      })
      .catch(err => {
        console.warn('Failed to load web-vitals:', err)
      })

    const resourceMonitor = window.setTimeout(() => {
      if (!window.performance || !window.performance.getEntriesByType) {
        return
      }

      const resources = window.performance.getEntriesByType('resource')
      const slowResources = resources.filter(
        resource => resource.duration > 1000
      )

      if (slowResources.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('[Performance] Slow resources detected:', slowResources)
      }
    }, 5000)

    return () => {
      window.clearTimeout(resourceMonitor)
    }
  }, [])

  return null
}

export default PerformanceMonitor
