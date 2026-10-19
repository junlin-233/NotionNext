import { siteConfig } from '@/lib/config'
import { isBrowser } from '@/lib/utils'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import DarkModeButton from './DarkModeButton'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import RandomPostButton from './RandomPostButton'
import ReadingProgress from './ReadingProgress'
import SearchButton from './SearchButton'
import SlideOver from './SlideOver'

/**
 * 页头：顶部导航
 * @param {*} param0
 * @returns
 */
const Header = props => {
  // 文章页的导航栏要浮在封面上，一上来就该是 fixed。
  // 原来初始值固定写死 false，服务端渲染出来 nav 占着 64px，
  // 等浏览器接管后 scrollTrigger 才把它切成 fixed，这 64px 一消失，
  // 整页内容就往上跳一次（CLS 的主要来源）。
  // 用 post 是否存在判断文章页，让首屏渲染直接就是最终状态。
  const [fixedNav, setFixedNav] = useState(Boolean(props?.post))
  const [textWhite, setTextWhite] = useState(false)
  const [navBgWhite, setBgWhite] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const router = useRouter()
  const slideOverRef = useRef()

  const toggleMenuOpen = () => {
    slideOverRef?.current?.toggleSlideOvers()
  }

  /**
   * 根据滚动条，切换导航栏样式
   */
  const scrollTrigger = () => {
    const scrollS = window.scrollY
    const atTop = scrollS <= 1
    const hasPostBackground = Boolean(document?.querySelector('#post-bg'))

    setFixedNav(!atTop || hasPostBackground)
    setBgWhite(!atTop)
    setTextWhite(atTop && hasPostBackground)
  }

  useEffect(() => {
    scrollTrigger()
  }, [router.asPath])

  // 监听滚动
  useEffect(() => {
    let frameId = null

    const handleScroll = () => {
      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        scrollTrigger()
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  // 导航栏根据滚动轮播菜单内容
  useEffect(() => {
    let prevScrollY = 0
    let ticking = false
    let frameId = null

    const handleScroll = () => {
      if (ticking) return

      frameId = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const nextIndex = currentScrollY > prevScrollY ? 1 : 0
        setActiveIndex(currentIndex =>
          currentIndex === nextIndex ? currentIndex : nextIndex
        )
        prevScrollY = currentScrollY
        ticking = false
        frameId = null
      })
      ticking = true
    }

    if (isBrowser) {
      window.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (isBrowser) {
        window.removeEventListener('scroll', handleScroll)
      }
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  return (
    <>
      <style jsx>{`
        @keyframes fade-in-down {
          0% {
            opacity: 0.5;
            transform: translateY(-30%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-up {
          0% {
            opacity: 0.5;
            transform: translateY(30%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in-down {
          animation: fade-in-down 0.3s ease-in-out;
        }

        .fade-in-up {
          animation: fade-in-up 0.3s ease-in-out;
        }
      `}</style>

      {/* fixed时留白高度。
          文章页有 #post-bg 封面，导航栏浮在图上不占位，所以不留白。
          服务端没有 document，用 typeof 判断，否则这里会抛 ReferenceError。 */}
      {fixedNav &&
        typeof document !== 'undefined' &&
        !document.querySelector('#post-bg') && <div className='h-16'></div>}

      {/* 顶部导航菜单栏 */}
      <nav
        id='nav'
        className={`z-20 h-16 top-0 w-full duration-300 transition-all
            ${fixedNav ? 'fixed' : 'relative bg-transparent'} 
            ${textWhite ? 'text-white ' : 'text-black dark:text-white'}  
            ${navBgWhite ? 'bg-white dark:bg-[#18171d] shadow' : 'bg-transparent'}`}>
        <div className='flex h-full mx-auto justify-between items-center max-w-[86rem] px-6'>
          {/* 左侧logo */}
          <Logo {...props} />

          {/* 中间菜单 */}
          <div
            id='nav-bar-swipe'
            className={`hidden lg:flex flex-grow flex-col items-center justify-center h-full relative w-full`}>
            <div
              className={`absolute transition-all duration-700 ${activeIndex === 0 ? 'opacity-100 mt-0' : '-mt-20 opacity-0 invisible'}`}>
              <MenuListTop {...props} />
            </div>
            <div
              className={`absolute transition-all duration-700 ${activeIndex === 1 ? 'opacity-100 mb-0' : '-mb-20 opacity-0 invisible'}`}>
              <h1 className='font-bold text-center text-light-400 dark:text-gray-400'>
                {siteConfig('AUTHOR') || siteConfig('TITLE')}{' '}
                {siteConfig('BIO') && <>|</>} {siteConfig('BIO')}
              </h1>
            </div>
          </div>

          {/* 右侧固定 */}
          <div className='flex flex-shrink-0 justify-end items-center w-48'>
            <RandomPostButton {...props} />
            <SearchButton {...props} />
            <div className='hidden md:block'>
              <DarkModeButton {...props} />
            </div>
            <ReadingProgress />

            {/* 移动端菜单按钮 */}
            <div
              onClick={toggleMenuOpen}
              className='flex lg:hidden w-8 justify-center items-center h-8 cursor-pointer'>
              <i className='fas fa-bars' />
            </div>
          </div>

          {/* 右边侧拉抽屉 */}
          <SlideOver cRef={slideOverRef} {...props} />
        </div>
      </nav>
    </>
  )
}

export default Header
