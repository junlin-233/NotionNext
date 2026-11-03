import SmartLink from '@/components/SmartLink'
import { useGlobal } from '@/lib/global'
import { useRouter } from 'next/router'
import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

const ShortCutActions = [
  { key: '↑ ↓', action: '选择' },
  { key: 'Enter', action: '跳转' },
  { key: 'Esc', action: '关闭' }
]

/**
 * 基于 Pagefind 的本地全文搜索弹窗
 * - 索引由 scripts/build-search-index.js 在构建后生成（public/pagefind/）
 * - pagefind.js 运行时按需加载，不进主 bundle
 * - 索引未生成（本地 dev）时给出提示
 * 打开方式 cRef.current.openSearch()
 */
export default function PagefindSearchModal({ cRef }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [indexStatus, setIndexStatus] = useState('loading') // loading | ready | unavailable
  const [isInputFocused, setIsInputFocused] = useState(false)

  const inputRef = useRef(null)
  const pagefindRef = useRef(null)
  const searchTimer = useRef(null)
  const router = useRouter()

  // 加载 pagefind 索引（仅首次打开时）
  useEffect(() => {
    if (!isModalOpen || pagefindRef.current) return
    let cancelled = false

    import(/* webpackIgnore: true */ '/pagefind/pagefind.js')
      .then(async pagefind => {
        if (cancelled) return
        // 页面元信息由索引时提供；让 pagefind 自动探测语言（zh-CN 已在 <html lang> 标注）
        if (pagefind.options) await pagefind.options({ excerptLength: 32 })
        pagefindRef.current = pagefind
        setIndexStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setIndexStatus('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [isModalOpen])

  useHotkeys('ctrl+k', e => {
    e.preventDefault()
    setIsModalOpen(true)
  })
  useHotkeys(
    'down',
    e => {
      if (isInputFocused) {
        e.preventDefault()
        if (activeIndex < searchResults.length - 1) setActiveIndex(i => i + 1)
      }
    },
    { enableOnFormTags: true }
  )
  useHotkeys(
    'up',
    e => {
      if (isInputFocused) {
        e.preventDefault()
        if (activeIndex > 0) setActiveIndex(i => i - 1)
      }
    },
    { enableOnFormTags: true }
  )
  useHotkeys(
    'esc',
    e => {
      if (isInputFocused) {
        e.preventDefault()
        setIsModalOpen(false)
      }
    },
    { enableOnFormTags: true }
  )
  useHotkeys(
    'enter',
    e => {
      if (isInputFocused && searchResults.length > 0) {
        e.preventDefault()
        onJumpSearchResult()
      }
    },
    { enableOnFormTags: true }
  )

  const onJumpSearchResult = () => {
    const result = searchResults[activeIndex]
    if (result) {
      router.push(result.url)
    }
  }

  const resetSearch = () => {
    setActiveIndex(0)
    setKeyword('')
    setSearchResults([])
    if (inputRef.current) inputRef.current.value = ''
  }

  // 路由变化自动关闭
  useEffect(() => {
    setIsModalOpen(false)
  }, [router])

  // 打开时聚焦
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      resetSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen])

  useImperativeHandle(cRef, () => ({
    openSearch: () => setIsModalOpen(true)
  }))

  const doSearch = async query => {
    const pagefind = pagefindRef.current
    if (!pagefind || !query || query.trim() === '') {
      setSearchResults([])
      setKeyword(query)
      return
    }
    setIsLoading(true)
    setKeyword(query)
    try {
      const search = await pagefind.search(query)
      const results = await Promise.all(
        (search?.results || []).slice(0, 10).map(r => r.data())
      )
      setSearchResults(results)
      setActiveIndex(0)
    } catch (e) {
      console.warn('[Pagefind] 搜索失败', e)
      setSearchResults([])
    }
    setIsLoading(false)
  }

  const handleInputChange = e => {
    const query = e.target.value
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void doSearch(query)
    }, 300)
  }

  const closeModal = () => setIsModalOpen(false)

  return (
    <div
      id='search-wrapper'
      className={`${
        isModalOpen ? 'opacity-100' : 'invisible opacity-0 pointer-events-none'
      } z-30 fixed h-screen w-screen left-0 top-0 sm:mt-[10vh] flex items-start justify-center mt-0`}>
      <div
        className={`${
          isModalOpen ? 'opacity-100' : 'invisible opacity-0 translate-y-10'
        } max-h-[80vh] flex flex-col justify-between w-full min-h-[10rem] h-full md:h-fit max-w-xl dark:bg-hexo-black-gray dark:border-gray-800 bg-white p-5 rounded-lg z-50 shadow border hover:border-blue-600 duration-300 transition-all `}>
        <div className='flex justify-between items-center'>
          <div className='text-2xl text-blue-600 dark:text-indigo-500 font-bold'>
            搜索
          </div>
          <div>
            <i
              className='text-gray-600 fa-solid fa-xmark p-1 cursor-pointer hover:text-blue-600'
              onClick={closeModal}></i>
          </div>
        </div>

        <input
          type='text'
          placeholder='在这里输入搜索关键词...'
          onChange={handleInputChange}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          className='text-black dark:text-gray-200 bg-gray-50 dark:bg-gray-600 outline-blue-500 w-full px-4 my-2 py-1 mb-4 border rounded-md'
          ref={inputRef}
        />

        {/* 标签组 */}
        <div className='mb-4'>
          <TagGroups />
        </div>

        {indexStatus === 'unavailable' && (
          <div className='text-slate-600 text-center my-4 text-base'>
            搜索索引未生成（本地开发环境无索引），部署后自动可用
          </div>
        )}
        {indexStatus === 'loading' && (
          <div className='text-slate-500 text-center my-4 text-sm'>
            正在加载索引...
          </div>
        )}
        {indexStatus === 'ready' &&
          searchResults.length === 0 &&
          keyword &&
          !isLoading && (
            <div>
              <p className='text-slate-600 text-center my-4 text-base'>
                {' '}
                无法找到相关结果
                <span className='font-semibold'>&quot;{keyword}&quot;</span>
              </p>
            </div>
          )}

        <ul className='flex-1 overflow-auto'>
          {searchResults.map((result, index) => (
            <li
              key={result.url}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onJumpSearchResult(index)}
              className={`cursor-pointer my-2 p-2 duration-100 rounded-lg
              ${activeIndex === index ? 'bg-blue-600 dark:bg-indigo-500' : ''}`}>
              <div
                className={`${
                  activeIndex === index
                    ? 'text-white'
                    : 'text-black dark:text-gray-300'
                } font-medium`}>
                {result.meta?.title || result.url}
              </div>
              {result.excerpt && (
                <div
                  className={`text-sm mt-1 line-clamp-2 ${
                    activeIndex === index
                      ? 'text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  dangerouslySetInnerHTML={{ __html: result.excerpt }}
                />
              )}
            </li>
          ))}
        </ul>

        <div className='flex items-center justify-between mt-2 sm:text-sm text-xs dark:text-gray-300'>
          <div className='flex items-center'>
            {ShortCutActions.map((action, index) => (
              <Fragment key={index}>
                <div className='border-gray-300 dark:text-gray-300 text-gray-600 px-2 rounded border inline-block'>
                  {action.key}
                </div>
                <span className='ml-2 mr-4 text-gray-600 dark:text-gray-300'>
                  {action.action}
                </span>
              </Fragment>
            ))}
          </div>
          <div className='text-gray-600 dark:text-gray-300 text-right'>
            <span>
              <i className='fa-solid fa-magnifying-glass'></i> Pagefind 本地索引
            </span>
          </div>
        </div>
      </div>

      {/* 遮罩 */}
      <div
        onClick={closeModal}
        className='z-30 fixed top-0 left-0 w-full h-full flex items-center justify-center glassmorphism'
      />
    </div>
  )
}

/**
 * 标签组
 */
function TagGroups() {
  const { tagOptions } = useGlobal()
  const firstTenTags = tagOptions?.slice(0, 10)

  return (
    <div id='tags-group' className='dark:border-gray-700 space-y-2'>
      {firstTenTags?.map((tag, index) => (
        <SmartLink
          passHref
          key={index}
          href={`/tag/${encodeURIComponent(tag.name)}`}
          className={'cursor-pointer inline-block whitespace-nowrap'}>
          <div
            className={
              'flex items-center text-black dark:text-gray-300 hover:bg-blue-600 dark:hover:bg-indigo-500 hover:scale-110 hover:text-white rounded-lg px-2 py-0.5 duration-150 transition-all'
            }>
            <div className='text-lg'>{tag.name} </div>
            {tag.count ? (
              <sup className='relative ml-1'>{tag.count}</sup>
            ) : (
              <></>
            )}
          </div>
        </SmartLink>
      ))}
    </div>
  )
}
