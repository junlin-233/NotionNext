import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { convertInnerUrl } from '@/lib/db/notion/convertInnerUrl'
import { loadExternalResource } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { GlobalStyle } from './GlobalStyle'

/**
 * 鍚勭鎻掍欢鑴氭湰
 * @param {*} props
 * @returns
 */
const ExternalPlugin = props => {
  const { NOTION_CONFIG } = props
  const { lang } = useGlobal()
  const DISABLE_PLUGIN = siteConfig('DISABLE_PLUGIN', null, NOTION_CONFIG)
  const ANALYTICS_BUSUANZI_ENABLE = siteConfig(
    'ANALYTICS_BUSUANZI_ENABLE',
    null,
    NOTION_CONFIG
  )
  const CUSTOM_RIGHT_CLICK_CONTEXT_MENU = siteConfig(
    'CUSTOM_RIGHT_CLICK_CONTEXT_MENU',
    null,
    NOTION_CONFIG
  )
  const CAN_COPY = siteConfig('CAN_COPY', null, NOTION_CONFIG)
  const ENABLE_NPROGRSS = siteConfig('ENABLE_NPROGRSS', false)
  const ADSENSE_GOOGLE_ID = siteConfig('ADSENSE_GOOGLE_ID', null, NOTION_CONFIG)
  const AD_WWADS_ID = siteConfig('AD_WWADS_ID', null, NOTION_CONFIG)

  const router = useRouter()
  useEffect(() => {
    const innerUrlTimer = window.setTimeout(() => {
      convertInnerUrl({ allPages: props?.allNavPages, lang })
    }, 500)

    return () => {
      window.clearTimeout(innerUrlTimer)
    }
  }, [lang, props?.allNavPages, router.asPath])

  useEffect(() => {
    if (DISABLE_PLUGIN) {
      return undefined
    }

    let adsenseTimer

    if (ADSENSE_GOOGLE_ID) {
      adsenseTimer = window.setTimeout(() => {
        import('@/components/GoogleAdsense').then(({ initGoogleAdsense }) => {
          initGoogleAdsense(ADSENSE_GOOGLE_ID)
        })
      }, 3000)
    }

    if (AD_WWADS_ID) {
      loadExternalResource('https://cdn.wwads.cn/js/makemoney.js', 'js')
    }

    return () => {
      window.clearTimeout(adsenseTimer)
    }
  }, [AD_WWADS_ID, ADSENSE_GOOGLE_ID, DISABLE_PLUGIN])

  if (DISABLE_PLUGIN) {
    return null
  }

  return (
    <>
      <GlobalStyle />
      {ANALYTICS_BUSUANZI_ENABLE && <Busuanzi />}
      {CUSTOM_RIGHT_CLICK_CONTEXT_MENU && <CustomContextMenu {...props} />}
      {!CAN_COPY && <DisableCopy />}
      {ENABLE_NPROGRSS && <LoadingProgress />}
    </>
  )
}

const Busuanzi = dynamic(() => import('@/components/Busuanzi'), { ssr: false })
const CustomContextMenu = dynamic(
  () => import('@/components/CustomContextMenu'),
  { ssr: false }
)
const DisableCopy = dynamic(() => import('@/components/DisableCopy'), {
  ssr: false
})
const LoadingProgress = dynamic(() => import('@/components/LoadingProgress'), {
  ssr: false
})

export default ExternalPlugin
