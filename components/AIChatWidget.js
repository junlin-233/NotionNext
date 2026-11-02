import { siteConfig } from '@/lib/config'
import { useEffect, useRef, useState } from 'react'

/**
 * 站内 AI 问答悬浮窗（P4.1）
 *
 * 只有配置了 NEXT_PUBLIC_AI_CHAT_ENABLE 才渲染；服务端没配 Key 时
 * /api/ai-chat 返回 503，前端降级为一句提示，不弹错误框。
 *
 * 视觉沿用 AISummary 的红色渐变头部，保持站内 AI 元素一致。
 */

const SUGGESTIONS = ['这个博客写过什么？', '有推荐的效率工具吗？', '作者的技术栈是什么？']

const AIChatWidget = () => {
  const enabled = siteConfig('AI_CHAT_ENABLE', false)
  const title = siteConfig('AI_CHAT_TITLE', '问问我写过什么')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [citations, setCitations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 组件卸载时中断进行中的请求
  useEffect(() => () => abortRef.current?.abort(), [])

  if (!enabled) return null

  const appendToLast = piece => {
    setMessages(prev => {
      if (!prev.length) return prev
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, content: last.content + piece }
      return next
    })
  }

  const ask = async question => {
    const text = (question ?? input).trim()
    if (!text || loading) return

    setInput('')
    setError('')
    setCitations([])
    setLoading(true)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' }
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.error || `请求失败（${res.status}）`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const event = JSON.parse(payload)
            if (event.type === 'delta') appendToLast(event.data)
            else if (event.type === 'citations') setCitations(event.data || [])
            else if (event.type === 'error') setError(event.data)
          } catch (e) {
            // 非 JSON 行忽略
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || '网络异常')
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  return (
    <>
      <button
        type='button'
        aria-label={title}
        onClick={() => setOpen(v => !v)}
        className='fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-105'
        style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' }}>
        <i className={open ? 'fa-solid fa-xmark' : 'fa-solid fa-comment-dots'} />
      </button>

      {open && (
        <div className='fixed bottom-20 right-4 md:right-6 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-[#1e1e1e]'>
          <div
            className='flex items-center gap-2 px-4 py-3 text-white'
            style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' }}>
            <i className='fa-solid fa-wand-magic-sparkles' />
            <div className='flex-grow text-sm font-bold'>{title}</div>
            <button
              type='button'
              aria-label='关闭'
              className='text-white/80 hover:text-white'
              onClick={() => setOpen(false)}>
              <i className='fa-solid fa-xmark' />
            </button>
          </div>

          <div
            ref={scrollRef}
            className='max-h-[50vh] min-h-[140px] space-y-3 overflow-y-auto px-4 py-3 text-sm text-gray-700 dark:text-gray-200'>
            {messages.length === 0 && (
              <div className='space-y-2'>
                <p className='text-gray-500 dark:text-gray-400'>
                  基于站内文章回答，找不到就说找不到。
                </p>
                <div className='flex flex-wrap gap-2'>
                  {SUGGESTIONS.map(text => (
                    <button
                      key={text}
                      type='button'
                      onClick={() => {
                        void ask(text)
                      }}
                      className='rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-red-400 hover:text-red-500 dark:border-gray-600 dark:text-gray-300'>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user'
                    ? 'ml-6 rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800'
                    : 'mr-2 leading-relaxed'
                }>
                {message.content || (loading ? '思考中…' : '')}
              </div>
            ))}

            {error && <p className='text-xs text-red-500'>{error}</p>}

            {citations.length > 0 && (
              <div className='border-t border-dashed border-gray-200 pt-2 dark:border-gray-700'>
                <p className='mb-1 text-xs text-gray-400'>参考文章</p>
                <ul className='space-y-1'>
                  {citations.map((item, index) => (
                    <li key={index} className='text-xs'>
                      {item.url ? (
                        <a
                          href={item.url}
                          className='text-red-500 hover:underline'>
                          [{index + 1}] {item.title}
                        </a>
                      ) : (
                        <span className='text-gray-500'>
                          [{index + 1}] {item.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <form
            className='flex items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700'
            onSubmit={event => {
              event.preventDefault()
              void ask()
            }}>
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder='问点什么…'
              maxLength={200}
              className='min-w-0 flex-grow bg-transparent text-sm outline-none placeholder:text-gray-400'
            />
            <button
              type='submit'
              disabled={loading || !input.trim()}
              className='rounded-md px-3 py-1 text-sm text-white disabled:opacity-40'
              style={{ background: '#c0392b' }}>
              {loading ? '…' : '发送'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export default AIChatWidget
