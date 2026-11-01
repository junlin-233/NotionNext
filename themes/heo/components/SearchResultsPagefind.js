import SmartLink from '@/components/SmartLink'
import { useGlobal } from '@/lib/global'
import { useEffect, useState } from 'react'

/**
 * 搜索页的 Pagefind 结果列表（纯客户端，不依赖服务端全站数据）
 * 索引由 yarn build:search 生成在 public/pagefind/
 */
export default function SearchResultsPagefind({ keyword }) {
  const { locale } = useGlobal()
  const [status, setStatus] = useState('loading') // loading | ready | unavailable
  const [results, setResults] = useState([])
  const [cost, setCost] = useState(0)

  useEffect(() => {
    if (!keyword) return
    let cancelled = false

    const run = async () => {
      setStatus('loading')
      try {
        const pagefind = await import(
          /* webpackIgnore: true */ '/pagefind/pagefind.js'
        )
        if (cancelled) return
        const started = performance.now()
        const search = await pagefind.search(keyword)
        const items = await Promise.all(
          (search?.results || []).slice(0, 20).map(r => r.data())
        )
        if (cancelled) return
        setResults(items)
        setCost(Math.round(performance.now() - started))
        setStatus('ready')
      } catch (e) {
        if (!cancelled) setStatus('unavailable')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [keyword])

  if (status === 'loading') {
    return (
      <div className='py-20 text-center text-gray-500'>
        正在搜索「{keyword}」...
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className='py-20 text-center text-gray-500'>
        搜索索引尚未生成（本地开发环境无索引），部署后自动可用。
      </div>
    )
  }

  return (
    <div id='posts-wrapper'>
      <div className='mb-6 px-2 text-gray-600 dark:text-gray-300'>
        共找到 <span className='font-semibold'>{results.length}</span> 篇与「
        {keyword}」相关的文章，用时 {cost} 毫秒
      </div>

      {results.length === 0 && (
        <div className='py-16 text-center text-gray-500'>
          {locale?.COMMON?.NO_RESULTS || '没有找到相关文章'}
        </div>
      )}

      <div className='space-y-4'>
        {results.map(result => (
          <SmartLink key={result.url} href={result.url}>
            <div className='cursor-pointer rounded-xl border border-gray-100 bg-white p-5 duration-200 hover:border-blue-500 dark:border-gray-700 dark:bg-[#1e1e1e]'>
              <div className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                {result.meta?.title || result.url}
              </div>
              {result.excerpt && (
                <div
                  className='mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400'
                  dangerouslySetInnerHTML={{ __html: result.excerpt }}
                />
              )}
              <div className='mt-2 text-xs text-gray-400'>{result.url}</div>
            </div>
          </SmartLink>
        ))}
      </div>
    </div>
  )
}
