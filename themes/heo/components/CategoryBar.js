import { ChevronDoubleLeft, ChevronDoubleRight } from '@/components/HeroIcons'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import CONFIG from '../config'

/**
 * 博客列表上方嵌入条
 * 第一个 tab 是「全部」，指向归档时间线；点分类只换数据，不换视图。
 * @param {*} props
 * @returns
 */
export default function CategoryBar(props) {
  const { categoryOptions, border = true } = props
  const { locale } = useGlobal()
  const router = useRouter()
  const [scrollRight, setScrollRight] = useState(false)
  const [overflow, setOverflow] = useState(false)
  // 创建一个ref引用
  const categoryBarItemsRef = useRef(null)

  const allTitle = siteConfig('HEO_CATEGORY_BAR_ALL_TITLE', '全部', CONFIG)
  // 首页上第一个 tab 就是首页本身；其他列表页的「全部」回到归档
  const isHome = router.pathname === '/'
  const firstItem = isHome
    ? { href: '/', name: locale.NAV.INDEX, active: true }
    : {
        href: '/archive',
        name: allTitle,
        active: router.pathname === '/archive'
      }

  // 分类装得下就不显示左右滚动箭头，省得点了一个没反应的按钮
  useEffect(() => {
    const el = categoryBarItemsRef.current
    if (!el) return
    const measure = () => {
      setOverflow(el.scrollWidth - el.clientWidth > 4)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [categoryOptions])

  // 点击#right时，滚动#category-bar-items到最右边
  const handleToggleScroll = () => {
    if (categoryBarItemsRef.current) {
      const { scrollWidth, clientWidth } = categoryBarItemsRef.current
      if (scrollRight) {
        categoryBarItemsRef.current.scrollLeft = 0
      } else {
        categoryBarItemsRef.current.scrollLeft = scrollWidth - clientWidth
      }
      setScrollRight(!scrollRight)
    }
  }

  return (
    <div
      id='category-bar'
      className={`scroll-reveal scroll-fade-in-up flex flex-nowrap justify-between items-center h-12 mb-4 space-x-2 w-full lg:bg-white dark:lg:bg-[#1e1e1e]
            ${border ? 'lg:border lg:hover:border dark:lg:border-gray-800 hover:border-indigo-600 dark:hover:border-indigo-500 ' : ''}  py-2 lg:px-3 rounded-xl transition-colors duration-200`}>
      <div
        id='category-bar-items'
        ref={categoryBarItemsRef}
        className='scroll-smooth max-w-4xl rounded-lg scroll-hidden flex justify-start flex-nowrap items-center overflow-x-scroll'>
        <MenuItem
          href={firstItem.href}
          name={firstItem.name}
          active={firstItem.active}
        />
        {categoryOptions?.map((c, index) => (
          <MenuItem key={index} href={`/category/${c.name}`} name={c.name} />
        ))}
      </div>

      {overflow && (
        <div id='category-bar-next' className='flex items-center justify-center'>
          <div
            id='right'
            className='cursor-pointer mx-2 dark:text-gray-300 dark:hover:text-indigo-500 hover:text-indigo-600'
            onClick={handleToggleScroll}>
            {scrollRight ? (
              <ChevronDoubleLeft className={'w-5 h-5'} />
            ) : (
              <ChevronDoubleRight className={'w-5 h-5'} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 按钮
 * @param {*} param0
 * @returns
 */
const MenuItem = ({ href, name, active }) => {
  const router = useRouter()
  const { category } = router.query
  const selected = active !== undefined ? active : category === name
  // 选中态实心，悬停态只铺浅底：两者同色的话鼠标划过就分不清当前在哪个分类
  const stateClass = selected
    ? 'text-white bg-indigo-600 dark:bg-indigo-500'
    : 'text-gray-700 dark:text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-500 dark:hover:bg-indigo-500/15'
  return (
    <SmartLink
      href={href}
      className={`whitespace-nowrap mr-2 duration-200 transition-colors font-bold px-2 py-0.5 rounded-md ${stateClass}`}>
      {name}
    </SmartLink>
  )
}
