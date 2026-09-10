import { siteConfig } from '@/lib/config'
import { loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'

/**
 * Artalk 自托管评论系统 @see https://artalk.js.org/
 * @returns {JSX.Element}
 * @constructor
 */

const Artalk = ({ siteInfo }) => {
  const artalkJs = siteConfig('COMMENT_ARTALK_JS')
  const artalkCss = siteConfig('COMMENT_ARTALK_CSS')
  const artalkServer = siteConfig('COMMENT_ARTALK_SERVER')
  const artalkLocale = siteConfig('LANG')
  const site = siteConfig('TITLE')

  useEffect(() => {
    let observer
    let cancelled = false

    const initArtalk = async () => {
      await loadExternalResource(artalkJs, 'js')
      await loadExternalResource(artalkCss, 'css')
      if (cancelled || !window?.Artalk) {
        return
      }

      const artalk = window.Artalk.init({
        server: artalkServer,
        el: '#artalk',
        locale: artalkLocale,
        site,
        darkMode: document.documentElement.classList.contains('dark')
      })

      observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.attributeName === 'class') {
            const isDark = document.documentElement.classList.contains('dark')
            artalk?.setDarkMode(isDark)
          }
        })
      })

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      })
    }

    initArtalk().catch(error => {
      if (!cancelled) {
        console.warn('Artalk 加载失败', error)
      }
    })
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [artalkCss, artalkJs, artalkLocale, artalkServer, site])

  return <div id='artalk'></div>
}

export default Artalk
