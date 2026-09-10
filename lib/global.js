import { APPEARANCE, LANG, NOTION_PAGE_ID } from '@/blog.config'
import { initDarkMode, saveDarkModeToLocalStorage } from '@/lib/dark-mode'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/router'
import { createContext, useContext, useEffect, useState } from 'react'
import { generateLocaleDict, initLocale, redirectUserLang } from './utils/lang'

/**
 * 全局上下文
 */
const GlobalContext = createContext()

export function GlobalContextProvider(props) {
  const {
    post,
    children,
    siteInfo,
    categoryOptions,
    tagOptions,
    NOTION_CONFIG
  } = props

  const [lang, updateLang] = useState(NOTION_CONFIG?.LANG || LANG) // 默认语言
  const [locale, updateLocale] = useState(
    generateLocaleDict(NOTION_CONFIG?.LANG || LANG)
  ) // 默认语言
  const [isLiteMode, setLiteMode] = useState(false)

  const defaultDarkMode = NOTION_CONFIG?.APPEARANCE || APPEARANCE
  const [isDarkMode, updateDarkMode] = useState(defaultDarkMode === 'dark') // 默认深色模式
  const [onLoading, setOnLoading] = useState(false) // 抓取文章数据
  const router = useRouter()

  // 登录验证相关
  const enableClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const { isLoaded, isSignedIn, user } = enableClerk
    ? /* eslint-disable-next-line react-hooks/rules-of-hooks */
      useUser()
    : { isLoaded: true, isSignedIn: false, user: false }

  // 是否全屏
  const fullWidth = post?.fullWidth ?? false

  // 切换深色模式
  const toggleDarkMode = () => {
    const newStatus = !isDarkMode
    saveDarkModeToLocalStorage(newStatus)
    updateDarkMode(newStatus)
    const htmlElement = document.getElementsByTagName('html')[0]
    htmlElement.classList?.remove(newStatus ? 'light' : 'dark')
    htmlElement.classList?.add(newStatus ? 'dark' : 'light')
  }

  function changeLang(lang) {
    if (lang) {
      updateLang(lang)
      updateLocale(generateLocaleDict(lang))
    }
  }

  // 添加路由变化时的语言处理
  useEffect(() => {
    initLocale(router.locale, changeLang, updateLocale)
    // 处理极简模式
    setLiteMode(router.query.lite === 'true')
  }, [router.locale, router.query.lite])

  // 首次加载成功
  useEffect(() => {
    initDarkMode(updateDarkMode, defaultDarkMode)
    // 处理多语言自动重定向
    if (
      NOTION_CONFIG?.REDIRECT_LANG &&
      String(NOTION_CONFIG.REDIRECT_LANG).toLowerCase() === 'true'
    ) {
      redirectUserLang(NOTION_PAGE_ID)
    }
    setOnLoading(false)
  }, [NOTION_CONFIG?.REDIRECT_LANG, defaultDarkMode])

  useEffect(() => {
    const handleStart = url => {
      setOnLoading(true)
    }

    const handleStop = () => {
      setOnLoading(false)
    }

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeError', handleStop)
    router.events.on('routeChangeComplete', handleStop)
    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleStop)
      router.events.off('routeChangeError', handleStop)
    }
  }, [router.events])

  return (
    <GlobalContext.Provider
      value={{
        isLiteMode,
        isLoaded,
        isSignedIn,
        user,
        fullWidth,
        NOTION_CONFIG,
        toggleDarkMode,
        onLoading,
        setOnLoading,
        lang,
        changeLang,
        locale,
        updateLocale,
        isDarkMode,
        updateDarkMode,
        siteInfo,
        categoryOptions,
        tagOptions
      }}>
      {children}
    </GlobalContext.Provider>
  )
}

export const useGlobal = () => useContext(GlobalContext)
