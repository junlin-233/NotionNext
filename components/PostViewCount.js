import { useEffect, useState } from 'react'

/**
 * 文章阅读数
 * 打开页面时记一次（同一会话同一篇只记一次），统计未启用时整块不渲染
 * @param {*} props slug 文章 slug；className 外层样式；icon 是否显示火焰图标
 */
export default function PostViewCount({ slug, className = '', icon = true }) {
  const [count, setCount] = useState(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    const storageKey = `pv:${slug}`
    const seen =
      typeof window !== 'undefined' && window.sessionStorage.getItem(storageKey)

    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, record: !seen })
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled || !data?.enabled) return
        window.sessionStorage.setItem(storageKey, '1')
        setCount(Number(data.count) || 0)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [slug])

  if (count === null) return null

  return (
    <span className={className} title='阅读量'>
      {icon && <i className='fa-solid fa-fire-flame-curved'></i>}{' '}
      {count.toLocaleString('zh-CN')}
    </span>
  )
}
