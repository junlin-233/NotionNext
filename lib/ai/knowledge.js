/**
 * 站内知识库检索（P4.1）
 *
 * 几百篇文章、几千段文本的量级，内存余弦相似度足够：
 * 冷启动读一次 JSON（<5MB），单次检索 <5ms。上向量数据库是过度设计。
 *
 * 找不到 content/.embeddings.json 就返回空，调用方据此关掉问答入口。
 */

import fs from 'fs'
import path from 'path'

const EMBEDDING_FILE = path.join(
  process.cwd(),
  'content',
  '.embeddings.json'
)

let cache = null
let cacheMtime = 0

export function isKnowledgeReady() {
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
