/**
 * 站内知识库检索（P4.1）
 *
 * 两种检索模式，自动选择：
 * 1. 向量模式：content/.embeddings.json 存在且配了 EMBEDDING_API_KEY 时，
 *    余弦相似度检索（内存计算，几百段 <5ms）
 * 2. 文本模式：没有 embedding（如 DeepSeek 这类无 embedding 接口的供应商），
 *    直接从 content/pages 下的 markdown 切段，用中文二元分词做覆盖率匹配。
 *    博客量级（几十篇文章）下召回质量够用，零外部依赖。
 */

import fs from 'fs'
import path from 'path'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const EMBEDDING_FILE = path.join(CONTENT_DIR, '.embeddings.json')
const CONTENT_INDEX_FILE = path.join(CONTENT_DIR, 'index.json')

let cache = null
let cacheMtime = 0

export function isKnowledgeReady() {
  try {
    return fs.existsSync(EMBEDDING_FILE) || fs.existsSync(CONTENT_INDEX_FILE)
  } catch (e) {
    return false
  }
}

export function hasEmbeddingKnowledge() {
  try {
    return fs.existsSync(EMBEDDING_FILE)
  } catch (e) {
    return false
  }
}

export function loadKnowledge() {
  if (!fs.existsSync(EMBEDDING_FILE)) return null
  const stat = fs.statSync(EMBEDDING_FILE)
  if (cache && stat.mtimeMs === cacheMtime) return cache

  try {
    const raw = JSON.parse(fs.readFileSync(EMBEDDING_FILE, 'utf8'))
    cache = {
      model: raw.model || '',
      chunks: (raw.chunks || []).filter(item => Array.isArray(item.vector))
    }
    cacheMtime = stat.mtimeMs
    return cache
  } catch (error) {
    console.warn('[knowledge] 读取 embedding 失败:', error.message)
    return null
  }
}

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 检索最相关段落
 * @param {number[]} vector 问题向量
 * @param {number} topK
 */
export function searchKnowledge(vector, topK = 5) {
  const knowledge = loadKnowledge()
  if (!knowledge || !Array.isArray(vector)) return []

  const scored = knowledge.chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(vector, chunk.vector)
  }))

  return scored
    .filter(item => item.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => ({ ...item.chunk, score: Number(item.score.toFixed(4)) }))
}

/**
 * 把命中段落拼成上下文，带编号方便模型引用
 */
export function buildContext(chunks) {
  return chunks
    .map((chunk, index) => {
      const heading = chunk.heading ? ` / ${chunk.heading}` : ''
      return `[${index + 1}] 《${chunk.title}》${heading}\n${chunk.text}`
    })
    .join('\n\n---\n\n')
}

/**
 * 引用列表（去重，按分数排序）
 */
export function toCitations(chunks, hrefById = new Map()) {
  const seen = new Set()
  const list = []
  for (const chunk of chunks) {
    const key = chunk.pageId || chunk.file
    if (seen.has(key)) continue
    seen.add(key)
    list.push({
      title: chunk.title,
      url: hrefById.get(chunk.pageId) || '',
      heading: chunk.heading || ''
    })
  }
  return list
}

// ---------- 文本检索模式 ----------

const TEXT_MIN_CHARS = 120
const TEXT_MAX_CHARS = 600

// 非文章页（Notion 站点自带的模板页），整页跳过
const NON_POST_FILES = new Set([
  '首页',
  '搜索',
  '归档',
  '历史归档',
  '文章分类',
  '文章标签',
  '友情链接',
  '配置中心',
  '关于'
])

// Notion 模板占位文本：含此标记的段落是模板占位页（英文命名的 Search/Archive 等），不进知识库
const TEMPLATE_MARKER = '一个简单的开头'

/** 中文二元分词（bigram），英文按词 */
function tokenize(text) {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, ' ')
    .trim()
  const tokens = new Set()
  // 英文/数字整词
  for (const word of normalized.match(/[a-z0-9]+/g) || []) {
    tokens.add(word)
  }
  // 去掉英文后的中文字符做 bigram
  const cjk = normalized.replace(/[a-z0-9]/g, '')
  for (let i = 0; i < cjk.length - 1; i++) {
    tokens.add(cjk.slice(i, i + 2))
  }
  if (cjk.length) tokens.add(cjk.slice(0, 2))
  return tokens
}

let textChunksCache = null
let textChunksMtime = 0

/**
 * 运行时从 content/pages 的 markdown 切段（与 scripts/build-embeddings.js 同口径的简化版）
 */
function loadTextChunks() {
  if (!fs.existsSync(CONTENT_INDEX_FILE)) return []
  const stat = fs.statSync(CONTENT_INDEX_FILE)
  if (textChunksCache && stat.mtimeMs === textChunksMtime) {
    return textChunksCache
  }

  const chunks = []
  try {
    const index = JSON.parse(fs.readFileSync(CONTENT_INDEX_FILE, 'utf8'))
    for (const page of index.pages || []) {
      if (NON_POST_FILES.has(page.file)) continue
      const mdFile = path.join(CONTENT_DIR, 'pages', `${page.file}.md`)
      if (!fs.existsSync(mdFile)) continue
      let body = fs.readFileSync(mdFile, 'utf8')
      if (body.startsWith('---')) {
        const end = body.indexOf('\n---', 3)
        if (end > -1) body = body.slice(end + 4)
      }

      let heading = ''
      let buffer = ''
      const push = () => {
        const text = buffer
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/\n{2,}/g, '\n')
          .trim()
        buffer = ''
        if (text.length < TEXT_MIN_CHARS / 2) return
        if (`${heading} ${text}`.includes(TEMPLATE_MARKER)) return
        chunks.push({
          id: `${page.file}#${chunks.length}`,
          pageId: page.id || '',
          file: page.file,
          title: page.title || page.file,
          heading,
          text: text.slice(0, TEXT_MAX_CHARS),
          tokens: tokenize(`${page.title} ${heading} ${text}`)
        })
      }

      for (const line of body.split('\n')) {
        const match = line.match(/^#{1,3}\s+(.*)/)
        if (match) {
          push()
          heading = match[1].trim()
          continue
        }
        buffer += `${line}\n`
        if (buffer.length >= TEXT_MAX_CHARS) push()
      }
      push()
    }
  } catch (error) {
    console.warn('[knowledge] 文本模式切段失败:', error.message)
    return []
  }

  textChunksCache = chunks
  textChunksMtime = stat.mtimeMs
  return chunks
}

/** token 的文档频率（IDF 用），在切段后计算 */
let tokenDfCache = null
function getTokenDf(chunks) {
  if (tokenDfCache) return tokenDfCache
  const df = new Map()
  for (const chunk of chunks) {
    for (const token of chunk.tokens) {
      df.set(token, (df.get(token) || 0) + 1)
    }
  }
  const idf = new Map()
  const total = chunks.length || 1
  for (const [token, count] of df) {
    idf.set(token, Math.log(1 + total / (1 + count)))
  }
  tokenDfCache = idf
  return idf
}

/**
 * 文本检索：问题 token 按 IDF 平方加权（锐化主题词，「是什么」这类高频疑问词权重趋近 0），
 * 覆盖率 + 标题命中加权。
 */
export function searchKnowledgeByText(question, topK = 5) {
  const chunks = loadTextChunks()
  if (!chunks.length) return []

  const queryTokens = tokenize(question)
  if (!queryTokens.size) return []

  const idf = getTokenDf(chunks)
  const weightOf = token => Math.pow(idf.get(token) || 1, 2)

  let queryWeight = 0
  for (const token of queryTokens) {
    queryWeight += weightOf(token)
  }
  if (queryWeight <= 0) return []

  const scored = []
  for (const chunk of chunks) {
    let hitWeight = 0
    let hitCount = 0
    for (const token of queryTokens) {
      if (chunk.tokens.has(token)) {
        hitWeight += weightOf(token)
        hitCount++
      }
    }
    if (!hitWeight) continue
    // 单 token 命中太容易误判（如某个罕见词恰好出现），要求至少 2 个不同词命中；
    // 查询本身只有一个词时（如「mem0」）放开
    if (queryTokens.size > 1 && hitCount < 2) continue
    let score = hitWeight / queryWeight
    if (chunk.title && question.includes(chunk.title.slice(0, 8))) {
      score += 0.3
    }
    scored.push({ chunk, score })
  }

  return scored
    .filter(item => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => {
      const { tokens, ...rest } = chunk
      return { ...rest, score: Number(score.toFixed(4)) }
    })
}
