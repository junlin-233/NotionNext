#!/usr/bin/env node
/**
 * 生成站内问答用的 embedding（P4.1）
 *
 * 输入：content/index.json + content/pages/<file>.md
 * 输出：content/.embeddings.json（不进 git，构建/部署时生成）
 *
 * 切段策略：按 markdown 标题切，每段 300–500 字，段前带「文章标题」上下文，
 * 检索命中后能直接拼出可读的引用片段。
 *
 * 用法：
 *   EMBEDDING_API_KEY=sk-xxx node scripts/build-embeddings.js
 *   node scripts/build-embeddings.js --limit=5        # 调试
 *   node scripts/build-embeddings.js --dry-run        # 只切段不打接口
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json')
const OUTPUT_FILE = path.join(CONTENT_DIR, '.embeddings.json')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i > -1 && args[i + 1] ? args[i + 1] : fallback
}
const hasFlag = name => args.includes(`--${name}`)

const BASE_URL = (
  process.env.EMBEDDING_BASE_URL ||
  process.env.AI_CHAT_BASE_URL ||
  'https://api.openai.com/v1'
).replace(/\/+$/, '')
const API_KEY = process.env.EMBEDDING_API_KEY || process.env.AI_CHAT_API_KEY || ''
const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
const LIMIT = Number(getArg('limit', 0))
const BATCH = Number(getArg('batch', 16))
const DRY_RUN = hasFlag('dry-run')

const MIN_CHARS = 120
const MAX_CHARS = 600

const log = (...msg) => console.log('[embeddings]', ...msg)

function stripFrontMatter(text) {
  if (!text.startsWith('---')) return { front: {}, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { front: {}, body: text }
  const rawFront = text.slice(3, end).trim()
  const body = text.slice(end + 4).replace(/^\n+/, '')
  const front = {}
  for (const line of rawFront.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value)
      } catch (e) {
        value = value.slice(1, -1)
      }
    }
    front[match[1]] = value
  }
  return { front, body }
}

/**
 * 按二级/三级标题切段，超长的段再按段落切
 */
function chunkMarkdown(body, meta) {
  const lines = body.split('\n')
  const blocks = []
  let current = { heading: '', lines: [] }

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (current.lines.join('').trim()) blocks.push(current)
      current = { heading: line.replace(/^#+\s+/, '').trim(), lines: [] }
      continue
    }
    current.lines.push(line)
  }
  if (current.lines.join('').trim()) blocks.push(current)

  const chunks = []
  for (const block of blocks) {
    const text = block.lines
      .join('\n')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
    if (!text) continue

    const paragraphs = text.split(/\n(?=[^\s])/).filter(Boolean)
    let buffer = ''
    const pushBuffer = () => {
      if (buffer.trim().length < MIN_CHARS / 2) {
        buffer = ''
        return
      }
      chunks.push({
        heading: block.heading,
        text: buffer.trim().slice(0, MAX_CHARS)
      })
      buffer = ''
    }

    for (const paragraph of paragraphs) {
      if ((buffer + paragraph).length > MAX_CHARS) pushBuffer()
      buffer += (buffer ? '\n' : '') + paragraph
      if (buffer.length >= MIN_CHARS) pushBuffer()
    }
    pushBuffer()
  }

  return chunks.map((chunk, index) => ({
    id: `${meta.file}#${index}`,
    pageId: meta.pageId || '',
    file: meta.file,
    title: meta.title,
    heading: chunk.heading,
    text: chunk.text,
    searchText: `${meta.title}${chunk.heading ? ` · ${chunk.heading}` : ''}\n${chunk.text}`
  }))
}

async function embedBatch(inputs) {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ model: MODEL, input: inputs })
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`embedding 接口 ${res.status}: ${detail.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding)
}

async function main() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error('content/index.json 不存在，先跑 yarn sync:content')
  }
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  const pages = LIMIT ? (index.pages || []).slice(0, LIMIT) : index.pages || []

  const chunks = []
  for (const page of pages) {
    const mdFile = path.join(CONTENT_DIR, 'pages', `${page.file}.md`)
    if (!fs.existsSync(mdFile)) continue
    const { body } = stripFrontMatter(fs.readFileSync(mdFile, 'utf8'))
    chunks.push(
      ...chunkMarkdown(body, {
        pageId: page.id,
        file: page.file,
        title: page.title || page.file
      })
    )
  }

  log(`切出 ${chunks.length} 段，来自 ${pages.length} 篇文章`)
  if (DRY_RUN) {
    log('dry-run，跳过接口调用')
    return
  }
  if (!API_KEY) {
    throw new Error('缺少 EMBEDDING_API_KEY / AI_CHAT_API_KEY')
  }

  // 已有向量按 text hash 复用，只请求新增段落
  const previous = fs.existsSync(OUTPUT_FILE)
    ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    : { chunks: [] }
  const previousByHash = new Map(
    (previous.chunks || []).map(item => [item.hash, item.vector])
  )

  for (const chunk of chunks) {
    chunk.hash = crypto
      .createHash('sha1')
      .update(chunk.searchText)
      .digest('hex')
  }

  const pending = chunks.filter(chunk => !previousByHash.has(chunk.hash))
  log(`需请求向量 ${pending.length} 段，复用 ${chunks.length - pending.length} 段`)

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)
    const vectors = await embedBatch(batch.map(item => item.searchText))
    batch.forEach((item, index) => {
      item.vector = vectors[index]
    })
    log(`已处理 ${Math.min(i + BATCH, pending.length)}/${pending.length}`)
  }

  const output = {
    model: MODEL,
    generatedAt: new Date().toISOString(),
    chunks: chunks.map(chunk => ({
      id: chunk.id,
      pageId: chunk.pageId,
      file: chunk.file,
      title: chunk.title,
      heading: chunk.heading,
      text: chunk.text,
      hash: chunk.hash,
      vector: chunk.vector || previousByHash.get(chunk.hash)
    }))
  }

  const missing = output.chunks.filter(item => !item.vector).length
  if (missing) log(`警告：${missing} 段没有向量，检索时会跳过`)

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output)}\n`, 'utf8')
  log(`写入 ${path.relative(ROOT, OUTPUT_FILE)}`)
}

main().catch(error => {
  console.error('[embeddings] 失败:', error)
  process.exit(1)
})
