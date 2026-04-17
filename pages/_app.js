// import '@/styles/animate.css' // @see https://animate.style/
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'

// core styles shared by all of react-notion-x (required)
import '@/styles/notion.css' //  重写部分notion样式
import 'react-notion-x/src/styles.css' // 原版的react-notion-x

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'

// 各种扩展插件 这个要阻塞引入
import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'
import { zhCN } from '@clerk/localizations'
import dynamic from 'next/dynamic'
// import { ClerkProvider } from '@clerk/nextjs'
const ClerkProvider = dynamic(() =>
  import('@clerk/nextjs').then(m => m.ClerkProvider)
)

const STALE_DEPLOYMENT_RELOAD_KEY = '__notionnext_stale_deployment_reload__'

function isStaleDeploymentRouteError(err) {
  if (!err || err.cancelled) return false

  const name = err?.name || ''
  const message = err?.message || ''

  return (
    name === 'ChunkLoadError' ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError') ||
    message.includes('Failed to load static props') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Failed to load script')
  )
}

function getReloadKey(url) {
  return `${STALE_DEPLOYMENT_RELOAD_KEY}:${url}`
}

/**
 * App挂载DOM 入口文件
 * @param {*} param0
 * @returns
 */
const MyApp = ({ Component, pageProps }) => {
  // 一些可能出现 bug 的样式，可以统一放入该钩子进行调整
  useAdjustStyle()

  const route = useRouter()
  const theme = useMemo(() => {
    return (
      getQueryParam(route.asPath, 'theme') ||
      pageProps?.NOTION_CONFIG?.THEME ||
      BLOG.THEME
    )
  }, [route])

  // 整体布局
  const GLayout = useCallback(
    props => {
      const Layout = getBaseLayoutByTheme(theme)
      return <Layout {...props} />
    },
    [theme]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    // A successful render means the current route no longer needs the stale-build fallback.
    window.sessionStorage.removeItem(getReloadKey(route.asPath))
  }, [route.asPath])

  useEffect(() => {
    const handleRouteError = (err, url) => {
      if (typeof window === 'undefined') return
      if (!isStaleDeploymentRouteError(err)) return

      const targetUrl = typeof url === 'string' && url ? url : route.asPath
      const reloadKey = getReloadKey(targetUrl)

      if (window.sessionStorage.getItem(reloadKey)) {
        return
      }

      window.sessionStorage.setItem(reloadKey, '1')
      window.location.assign(targetUrl)
    }

    route.events.on('routeChangeError', handleRouteError)
    return () => {
      route.events.off('routeChangeError', handleRouteError)
    }
  }, [route])

  const enableClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const content = (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
      </GLayout>
      <ExternalPlugins {...pageProps} />
    </GlobalContextProvider>
  )
  return (
    <>
      {enableClerk ? (
        <ClerkProvider localization={zhCN}>{content}</ClerkProvider>
      ) : (
        content
      )}
    </>
  )
}

export default MyApp
