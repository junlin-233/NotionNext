import {
  buildContext,
  hasEmbeddingKnowledge,
  searchKnowledgeByText,
  searchKnowledgeHybrid,
  toCitations
} from '@/lib/ai/knowledge'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { getClientIp } from '@/lib/middleware/security'
import { globalRateLimiter } from '@/lib/utils/validation'

/**
 * 站内 AI 问答（RAG）
 * POST /api/ai-chat  { question: string }
 *
 * 流程：问题向量化 → 内存余弦检索 top5 → 拼上下文 → LLM 流式回答（SSE）
 * 回答只基于检索到的段落，没依据就明说，避免幻觉。
 *
 * 环境变量（服务端，不进客户端 bundle）：
 *   AI_CHAT_BASE_URL  OpenAI 兼容地址，默认 https://api.openai.com/v1
 *   AI_CHAT_API_KEY   必填，没有就直接 503
 *   AI_CHAT_MODEL     默认 gpt-4o-mini
 *   EMBEDDING_MODEL   默认 text-embedding-3-small，需与 scripts/build-embeddings.js 一致
 */

export const config = {
  api: {
    responseLimit: false
  }
}

const BASE_URL = (process.env.AI_CHAT_BASE_URL || 'https://api.openai.com/v1').replace(
  /\/+$/,
  ''
)
const API_KEY = process.env.AI_CHAT_API_KEY || ''
const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'gpt-4o-mini'
const EMBEDDING_BASE_URL = (
  process.env.EMBEDDING_BASE_URL ||
  process.env.AI_CHAT_BASE_URL ||
  'https://api.openai.com/v1'
).replace(/\/+$/, '')
const EMBEDDING_API_KEY =
  process.env.EMBEDDING_API_KEY || process.env.AI_CHAT_API_KEY || ''
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

const RATE_LIMIT = 6
const RATE_WINDOW = 60 * 1000
const CACHE_TTL = 30 * 60 * 1000
const CACHE_MAX = 200
const QUESTION_MAX = 200

const answerCache = new Map()

function getCached(question) {
  const hit = answerCache.get(question)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL) {
    answerCache.delete(question)
    return null
  }
  return hit
}

function setCached(question, value) {
  if (answerCache.size >= CACHE_MAX) {
    const oldest = answerCache.keys().next().value
    answerCache.delete(oldest)
  }
  answerCache.set(question, { ...value, at: Date.now() })
}

const SYSTEM_PROMPT = `你是这个博客的站内助手，只根据提供的文章片段回答。
规则：
1. 只用给出的片段作答，不要引入片段之外的知识
2. 片段不足以回答时，直接说「站内文章没有写到这一点」，不要编造
3. 回答用中文，简洁分段，不超过 300 字
4. 提到某个观点时用 [1] [2] 标注来源编号`

let hrefCache = { at: 0, map: new Map() }

async function loadHrefMap() {
  if (Date.now() - hrefCache.at < 10 * 60 * 1000 && hrefCache.map.size) {
    return hrefCache.map
  }
  try {
    const props = await fetchGlobalAllData({ from: 'ai-chat' })
    const map = new Map()
    for (const post of props.allPages || []) {
      if (!post?.id) continue
      map.set(post.id, post.href ? `/${String(post.href).replace(/^\/+/, '')}` : '')
    }
    hrefCache = { at: Date.now(), map }
    return map
  } catch (error) {
    console.warn('[ai-chat] 取文章地址失败:', error.message)
    return new Map()
  }
}

async function embedQuestion(question) {
  const res = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMBEDDING_API_KEY}`
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: question })
  })
  if (!res.ok) {
    throw new Error(`embedding ${res.status}`)
  }
  const json = await res.json()
  return json?.data?.[0]?.embedding || null
}

/**
 * 检索：向量+词法混合优先（有 embedding 文件 + Key），失败或缺失时纯文本模式。
 * 文本模式用中文二元分词覆盖率匹配，不需要 embedding 接口，
 * 兼容 DeepSeek 这类只提供 chat 的供应商。
 */
async function retrieveChunks(question) {
  if (hasEmbeddingKnowledge() && EMBEDDING_API_KEY) {
    try {
      const vector = await embedQuestion(question)
      const chunks = searchKnowledgeHybrid(vector, question, 5)
      if (chunks.length) return chunks
    } catch (error) {
      console.warn('[ai-chat] 向量检索失败，降级文本检索:', error.message)
    }
  }
  return searchKnowledgeByText(question, 5)
}

function send(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function streamAnswer(res, question, chunks) {
  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `片段：\n\n${buildContext(chunks)}\n\n问题：${question}`
        }
      ]
    })
  })

  if (!upstream.ok || !upstream.body) {
    throw new Error(`chat ${upstream.status}`)
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json?.choices?.[0]?.delta?.content
        if (delta) {
          answer += delta
          send(res, { type: 'delta', data: delta })
        }
      } catch (e) {
        // 上游偶发非 JSON 行，跳过
      }
    }
  }

  return answer
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  if (!API_KEY) {
    res.status(503).json({ error: '未配置 AI_CHAT_API_KEY' })
    return
  }

  const question = String(req.body?.question || '').trim().slice(0, QUESTION_MAX)
  if (!question) {
    res.status(400).json({ error: 'question 不能为空' })
    return
  }

  const ip = getClientIp(req)
  if (globalRateLimiter.isRateLimited(`ai-chat:${ip}`, RATE_LIMIT, RATE_WINDOW)) {
    res.status(429).json({ error: '问得太快了，休息一下再来' })
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  try {
    const cached = getCached(question)
    if (cached) {
      send(res, { type: 'citations', data: cached.citations })
      // 缓存命中也按流式发，前端只认一种协议
      for (const piece of cached.answer.match(/[\s\S]{1,24}/g) || []) {
        send(res, { type: 'delta', data: piece })
      }
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // 引用链接用站点自己算的 href（带 URL_PREFIX/多语言前缀），不要自己拼
    const hrefById = await loadHrefMap()

    const chunks = await retrieveChunks(question)

    if (!chunks.length) {
      send(res, {
        type: 'delta',
        data: '站内文章没有检索到相关内容，换个说法试试？'
      })
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    const citations = toCitations(chunks, hrefById)
    send(res, { type: 'citations', data: citations })

    const answer = await streamAnswer(res, question, chunks)
    if (answer) setCached(question, { answer, citations })

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    console.error('[ai-chat] 失败:', error.message)
    send(res, { type: 'error', data: '回答生成失败，稍后再试' })
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
