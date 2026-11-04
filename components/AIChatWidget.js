import { siteConfig } from '@/lib/config'
import { useEffect, useRef, useState } from 'react'

/**
 * 站内 AI 问答悬浮窗（P4.1）
 *
 * 只有配置了 NEXT_PUBLIC_AI_CHAT_ENABLE 才渲染；服务端没配 Key 时
 * /api/ai-chat 返回 503，前端降级为一句提示，不弹错误框。
 *
 * 视觉：入口是能展开文字的胶囊悬浮键，面板走阅读器质感 —— 头部只留身份
 * 和口径说明，助手回答用裸文本 + 内联引用角标，用户消息用中性气泡。
 * 品牌红只做点缀，不铺大面积渐变，避免做成客服插件。
 */

const SUGGESTIONS = [
  '这个博客写过什么？',
  '有推荐的效率工具吗？',
  '作者的技术栈是什么？'
]

const BRAND = 'linear-gradient(135deg, #e8584a 0%, #c0392b 100%)'

/* 四角星芒 + 小星：比通用对话气泡更能说明"这是 AI" */
const Sparkle = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    fill='currentColor'
    aria-hidden='true'
    className={className}>
    <path d='M11 2.6c.3-.8 1.4-.8 1.7 0l1.9 5.2a1 1 0 0 0 .6.6l5.2 1.9c.8.3.8 1.4 0 1.7l-5.2 1.9a1 1 0 0 0-.6.6l-1.9 5.2c-.3.8-1.4.8-1.7 0l-1.9-5.2a1 1 0 0 0-.6-.6L3.3 12c-.8-.3-.8-1.4 0-1.7l5.2-1.9a1 1 0 0 0 .6-.6L11 2.6z' />
    <path
      d='M18.4 15.4c.2-.5.9-.5 1.1 0l.7 1.9a.6.6 0 0 0 .4.4l1.9.7c.5.2.5.9 0 1.1l-1.9.7a.6.6 0 0 0-.4.4l-.7 1.9c-.2.5-.9.5-1.1 0l-.7-1.9a.6.6 0 0 0-.4-.4l-1.9-.7c-.5-.2-.5-.9 0-1.1l1.9-.7a.6.6 0 0 0 .4-.4l.7-1.9z'
      opacity='.75'
    />
  </svg>
)

const CloseIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    aria-hidden='true'
    className={className}>
    <path d='M6 6l12 12M18 6L6 18' />
  </svg>
)

const ArrowIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    className={className}>
    <path d='M5 12h13M13 6l6 6-6 6' />
  </svg>
)

const SendIcon = ({ className = '' }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    className={className}>
    <path d='M12 19V6M6 12l6-6 6 6' />
  </svg>
)

/**
 * 轻量渲染：只处理 **加粗**、行首列表符和 [1] 角标这三类，
 * 够 LLM 回答用，不为了几个星号引入 markdown 依赖。
 */
const renderInline = (text, citations, keyPrefix) => {
  const chip =
    'relative -top-[4px] mx-[1px] inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-[3px] px-[3px] align-baseline text-[9.5px] font-semibold text-[#c0392b] transition-colors hover:bg-[#e8584a]/15 dark:text-[#f0918a] dark:hover:bg-[#e8584a]/25'

  return String(text)
    .split(/(\*\*[^*]+\*\*|\[\d+\])/g)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong
            key={key}
            className='font-semibold text-gray-900 dark:text-white'>
            {part.slice(2, -2)}
          </strong>
        )
      }
      const match = /^\[(\d+)\]$/.exec(part)
      if (!match) return <span key={key}>{part}</span>
      const cite = citations[Number(match[1]) - 1]
      return cite?.url ? (
        <a
          key={key}
          href={cite.url}
          className={`${chip} hover:bg-[#e8584a]/15`}>
          {match[1]}
        </a>
      ) : (
        <span key={key} className={chip}>
          {match[1]}
        </span>
      )
    })
}

const AnswerBody = ({ text, citations, caret }) => {
  const lines = String(text)
    .split(/\n+/)
    .filter(line => line.trim())

  return (
    <div className='space-y-2'>
      {lines.map((line, index) => {
        const heading = /^#{1,6}\s+/.test(line)
        const bullet = !heading && /^[-*]\s+/.test(line)
        const content = heading
          ? line.replace(/^#{1,6}\s+/, '')
          : bullet
            ? line.replace(/^[-*]\s+/, '')
            : line
        const last = index === lines.length - 1

        return (
          <div key={index} className={bullet ? 'flex gap-1.5' : ''}>
            {bullet && (
              <span className='mt-[9px] h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500' />
            )}
            <span
              className={`min-w-0 break-words ${heading ? 'font-semibold text-gray-900 dark:text-white' : ''}`}>
              {renderInline(content, citations, index)}
              {last && caret && <span className='ai-caret' />}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const TypingDots = () => (
  <span className='inline-flex items-center gap-1 py-1.5'>
    {[0, 1, 2].map(index => (
      <span
        key={index}
        className='ai-dot h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600'
        style={{ animationDelay: `${index * 150}ms` }}
      />
    ))}
  </span>
)

const AIChatWidget = () => {
  const enabled = siteConfig('AI_CHAT_ENABLE', false)
  const title = siteConfig('AI_CHAT_TITLE', '问问我写过什么')
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
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

  // 面板挂载后再切到展开态，否则初始样式和展开态在同一帧提交，过渡不触发
  useEffect(() => {
    if (!open) {
      setShown(false)
      return undefined
    }
    const timer = setTimeout(() => setShown(true), 16)
    return () => clearTimeout(timer)
  }, [open])

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

  const lastIndex = messages.length - 1

  return (
    <>
      <button
        type='button'
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={`group fixed bottom-5 right-5 z-40 flex h-[52px] items-center rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_12px_28px_-10px_rgba(0,0,0,0.4)] ring-1 ring-black/5 transition-all duration-300 ease-out hover:shadow-[0_2px_10px_rgba(0,0,0,0.1),0_18px_36px_-12px_rgba(0,0,0,0.45)] dark:bg-[#2a2a2e] dark:ring-white/10 md:bottom-6 md:right-6 ${
          open ? '' : 'hover:pr-4'
        }`}>
        <span
          className='relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white'
          style={{ background: BRAND }}>
          <span className='absolute inset-0 rounded-full bg-[#e8584a] opacity-0 blur-[6px] transition-opacity duration-300 group-hover:opacity-50' />
          <span className='relative grid h-5 w-5 place-items-center'>
            <Sparkle
              className={`absolute h-5 w-5 transition-all duration-300 ${
                open
                  ? 'rotate-90 scale-50 opacity-0'
                  : 'rotate-0 scale-100 opacity-100'
              }`}
            />
            <CloseIcon
              className={`absolute h-4 w-4 transition-all duration-300 ${
                open
                  ? 'rotate-0 scale-100 opacity-100'
                  : '-rotate-90 scale-50 opacity-0'
              }`}
            />
          </span>
        </span>
        <span
          className={`overflow-hidden whitespace-nowrap text-[13px] font-medium text-gray-700 transition-all duration-300 ease-out dark:text-gray-200 ${
            open
              ? 'ml-0 max-w-0 opacity-0'
              : 'ml-0 max-w-0 opacity-0 group-hover:ml-2.5 group-hover:max-w-[190px] group-hover:opacity-100'
          }`}>
          {title}
        </span>
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={title}
          className={`fixed inset-x-3 bottom-3 z-40 flex max-h-[78vh] min-h-[320px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.12),0_40px_80px_-32px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06] transition-all duration-200 ease-out dark:bg-[#2c2c31] dark:ring-white/[0.16] md:inset-x-auto md:bottom-24 md:right-6 md:max-h-[min(620px,calc(100vh-8rem))] md:min-h-[440px] md:w-[384px] ${
            shown
              ? 'translate-y-0 scale-100 opacity-100'
              : 'translate-y-2 scale-[0.98] opacity-0'
          }`}
          style={{ transformOrigin: 'bottom right' }}>
          <div
            className='h-[2px] w-full shrink-0'
            style={{
              background:
                'linear-gradient(90deg, #e8584a 0%, #c0392b 72%, #a83226 100%)'
            }}
          />
          <div className='flex items-center gap-2.5 border-b border-gray-200/70 px-4 pb-3 pt-3.5 dark:border-white/[0.08]'>
            <span
              className='grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]'
              style={{ background: BRAND }}>
              <Sparkle className='h-4 w-4' />
            </span>
            <div className='min-w-0 flex-grow'>
              <div className='truncate text-[14px] font-semibold leading-tight text-gray-900 dark:text-gray-100'>
                {title}
              </div>
              <div className='mt-1 truncate text-[11.5px] leading-tight text-gray-400 dark:text-gray-400/80'>
                只依据站内文章 · 找不到会直说
              </div>
            </div>
            <button
              type='button'
              aria-label='关闭'
              className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200'
              onClick={() => setOpen(false)}>
              <CloseIcon className='h-3.5 w-3.5' />
            </button>
          </div>

          <div
            ref={scrollRef}
            className='ai-scroll min-h-[132px] flex-1 space-y-4 overflow-y-auto bg-[#fafafa] px-4 py-4 dark:bg-[#1f1f23]'>
            {messages.length === 0 && (
              <div className='flex h-full min-h-[180px] flex-col justify-center'>
                <h3 className='text-[15px] font-semibold text-gray-900 dark:text-gray-100'>
                  想找点什么？
                </h3>
                <p className='mt-1 text-[12px] text-gray-400 dark:text-gray-500'>
                  站内文章都读过，直接问就行。
                </p>
                <div className='mt-4 flex flex-wrap gap-1.5'>
                  {SUGGESTIONS.map(text => (
                    <button
                      key={text}
                      type='button'
                      onClick={() => {
                        void ask(text)
                      }}
                      className='group inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] leading-snug text-gray-600 transition-all duration-150 hover:border-[#e8584a]/40 hover:bg-[#fdf5f4] hover:text-[#b3352a] dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-gray-300 dark:hover:border-[#e8584a]/40 dark:hover:bg-[#e8584a]/10 dark:hover:text-[#f0918a]'>
                      <span className='min-w-0 truncate'>{text}</span>
                      <ArrowIcon className='h-3 w-3 shrink-0 -translate-x-0.5 text-[#e8584a] opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100' />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              if (message.role === 'user') {
                return (
                  <div key={index} className='ai-enter flex justify-end'>
                    <div className='max-w-[86%] rounded-[16px] rounded-br-[6px] bg-[#ecedef] px-3.5 py-2 text-[13.5px] leading-[1.6] text-gray-800 dark:bg-white/[0.1] dark:text-gray-100'>
                      {message.content}
                    </div>
                  </div>
                )
              }

              const streaming = loading && index === lastIndex
              return (
                <div
                  key={index}
                  className='ai-enter text-[13.5px] leading-[1.75] text-gray-700 dark:text-gray-300'>
                  {message.content ? (
                    <AnswerBody
                      text={message.content}
                      citations={citations}
                      caret={streaming}
                    />
                  ) : streaming ? (
                    <TypingDots />
                  ) : null}
                </div>
              )
            })}

            {error && (
              <div className='rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-600 dark:bg-red-500/10 dark:text-red-400'>
                {error}
              </div>
            )}

            {citations.length > 0 && (
              <div className='border-t border-dashed border-gray-200 pt-3 dark:border-white/10'>
                <p className='mb-1.5 text-[11px] text-gray-400 dark:text-gray-400/70'>
                  参考
                </p>
                <div className='flex flex-wrap gap-1.5'>
                  {citations.map((item, index) => {
                    const body = (
                      <>
                        <span className='tabular-nums text-gray-300 transition-colors group-hover:text-[#e8584a] dark:text-gray-600'>
                          {index + 1}
                        </span>
                        <span className='truncate'>{item.title}</span>
                      </>
                    )
                    const cls =
                      'group inline-flex max-w-full items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11.5px] leading-tight text-gray-500 ring-1 ring-gray-200/80 transition-colors hover:bg-[#fdf5f4] hover:text-[#b3352a] hover:ring-[#e8584a]/30 dark:bg-white/[0.07] dark:text-gray-300 dark:ring-white/[0.12] dark:hover:bg-[#e8584a]/10 dark:hover:text-[#f0918a]'
                    return item.url ? (
                      <a key={index} href={item.url} className={cls}>
                        {body}
                      </a>
                    ) : (
                      <span key={index} className={cls}>
                        {body}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <form
            className='border-t border-gray-200/70 bg-white px-3 pb-3 pt-3 dark:border-white/[0.08] dark:bg-[#2c2c31]'
            onSubmit={event => {
              event.preventDefault()
              void ask()
            }}>
            <div className='flex items-center gap-1.5 rounded-full bg-[#f2f3f5] py-1 pl-4 pr-1 transition-all duration-200 focus-within:bg-white focus-within:shadow-[0_0_0_1.5px_rgba(232,88,74,0.35)] dark:bg-white/[0.06] dark:focus-within:bg-[#26262a] dark:focus-within:shadow-[0_0_0_1.5px_rgba(232,88,74,0.45)]'>
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder='问点什么…'
                maxLength={200}
                aria-label='提问'
                className='h-9 min-w-0 flex-grow bg-transparent text-[13.5px] text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500'
              />
              <button
                type='submit'
                aria-label='发送'
                disabled={loading || !input.trim()}
                className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#cf4536] text-white transition-all duration-150 hover:bg-[#b3352a] disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-white/[0.12] dark:disabled:text-gray-500'>
                {loading ? (
                  <span className='ai-spin h-3.5 w-3.5 rounded-full border-[1.8px] border-white/40 border-t-white' />
                ) : (
                  <SendIcon className='h-4 w-4' />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .ai-dot {
          animation: ai-bounce 1.15s ease-in-out infinite;
        }
        @keyframes ai-bounce {
          0%,
          60%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
        .ai-caret {
          display: inline-block;
          width: 2px;
          height: 13px;
          margin-left: 2px;
          border-radius: 1px;
          vertical-align: -2px;
          background: #c0392b;
          animation: ai-blink 1s steps(2, start) infinite;
        }
        @keyframes ai-blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.1;
          }
        }
        .ai-enter {
          animation: ai-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @keyframes ai-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        .ai-spin {
          animation: ai-rot 0.7s linear infinite;
        }
        @keyframes ai-rot {
          to {
            transform: rotate(360deg);
          }
        }
        .ai-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.14) transparent;
        }
        .ai-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .ai-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.14);
          border-radius: 999px;
        }
        .ai-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        :global(.dark) .ai-scroll {
          scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
        }
        :global(.dark) .ai-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.16);
        }
        :global(.dark) .ai-caret {
          background: #f0918a;
        }
        @media (prefers-reduced-motion: reduce) {
          .ai-enter,
          .ai-dot,
          .ai-caret,
          .ai-spin {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}

export default AIChatWidget
