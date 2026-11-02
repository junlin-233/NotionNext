#!/usr/bin/env node
/**
 * Notion → Git 内容同步器（P3.1）
 *
 * 做什么：
 * 1. 拉站点数据库页的原始 recordMap，写成 content/sites/<id>.json
 * 2. 逐篇拉文章 recordMap，写成 content/pages/<file>.json，并生成同名 .md
 * 3. 扫描 recordMap 里的 Notion 图片，下载到 public/images/notion/，把地址改成本地路径
 * 4. 写 content/index.json，记录 id → 文件、以及 lastEditedTime 供下次增量判断
 *
 * 为什么存原始 recordMap 而不是转好的数据：
 * 转换逻辑（normalize/adapter/pageProperties）在 Next 里，带着 @/ 别名和 TS，
 * 脚本里复制一份必然漂移。原始数据落盘，运行时由 GitDataApi 复用同一套转换，
 * 两侧输出天然一致。
 *
 * 用法：
 *   node scripts/sync-notion.js                # 增量
 *   node scripts/sync-notion.js --force        # 全量重写
 *   node scripts/sync-notion.js --limit=3      # 只同步 3 篇（调试）
 *   node scripts/sync-notion.js --no-images    # 不下图，只同步文本
 *   node scripts/sync-notion.js --dry-run      # 只打印将要做的事
 */

const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const crypto = require('crypto')

const ROOT = process.cwd()

// Next 启动时会自己加载 .env.local，裸 node 脚本不会。
// 不加载就会退回 blog.config 里的默认 NOTION_PAGE_ID（模板示例站），
// 同步出一整套模板内容，看起来正常其实全错。
require('@next/env').loadEnvConfig(ROOT)
const CONTENT_DIR = path.join(ROOT, 'content')
const SITE_DIR = path.join(CONTENT_DIR, 'sites')
const PAGE_DIR = path.join(CONTENT_DIR, 'pages')
const IMAGE_DIR = path.join(ROOT, 'public', 'images', 'notion')
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json')

const {
  collectImageSources,
  applyImageMap,
  resolveDownloadUrl,
  guessExt,
  normalizeImageKey
} = require('./lib/notion-images.cjs')
const {
  recordMapToMarkdown,
  getTitle,
  getPlainProperty,
  resolvePropertyKey,
  resolveTitleKey
} = require('./lib/notion-markdown.cjs')

const IMAGE_CONCURRENCY = 6
const IMAGE_TIMEOUT = 30000
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const BLOCK_BATCH = 30
// Notion 对连续 loadPageChunk 很敏感，几十篇连着拉必 429。
// 每篇之间留间隔 + 指数退避重试，比并发拉更省时间（被限流后等待更久）。
const DEFAULT_INTERVAL = 2500
const MAX_RETRY = 5

// ── 参数 ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flags = {
  force: argv.includes('--force'),
  noImages: argv.includes('--no-images'),
  dryRun: argv.includes('--dry-run'),
  limit: Number(
    (argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0
  ),
  interval: Number(
    (argv.find(a => a.startsWith('--interval=')) || '').split('=')[1] ||
      DEFAULT_INTERVAL
  )
}

// ── 工具 ────────────────────────────────────────────────────────────────────

const log = (...args) => console.log('[sync]', ...args)

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex')
}

function sanitizeFileName(input, fallback) {
  const cleaned = String(input || '')
    .replace(/\//g, '__')
    .replace(/[\\:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

function stripLocalePrefix(id) {
  return id.includes(':') ? id.split(':').slice(-1)[0] : id
}

function blockValue(block) {
  return block?.value?.value || block?.value || null
}

async function createNotionClient() {
  const BLOG = require(path.join(ROOT, 'blog.config.js'))
  const { NotionAPI } = await import('notion-client')
  return new NotionAPI({
    apiBaseUrl: BLOG.API_BASE_URL || 'https://www.notion.so/api/v3',
    authToken: BLOG.NOTION_TOKEN_V2 || null,
    activeUser: BLOG.NOTION_ACTIVE_USER || null,
    userTimeZone: 'Asia/Shanghai',
    ofetchOptions: {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://www.notion.so/'
      }
    }
  })
}

async function mapLimit(items, limit, worker) {
  const results = []
  let cursor = 0
  const runners = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (cursor < items.length) {
        const index = cursor++
        results[index] = await worker(items[index], index)
      }
    })
  await Promise.all(runners)
  return results
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带退避的页面拉取：429 时等 2^n 秒再试
 */
async function fetchPageWithRetry(notion, pageId, options = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      return await notion.getPage(pageId, options)
    } catch (error) {
      lastError = error
      const message = String(error?.message || '')
      // 403 有两类：整站限流（这时候重试也没用）和单页无权限（重试更没用）。
      // 只对明确的限流/网关错误退避，403 直接放弃，避免每篇卡两分钟。
      const retryable =
        /429|Too Many Requests|502|503|504|timeout|ECONNRESET/i.test(message)
      if (!retryable || attempt === MAX_RETRY) break
      const wait = 5000 * Math.pow(2, attempt)
      console.warn(
        `[sync] 拉取受限，${wait}ms 后重试 (${attempt + 1}/${MAX_RETRY}): ${pageId}`
      )
      await sleep(wait)
    }
  }
  throw lastError
}

async function readJson(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch (e) {
    return null
  }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function writeText(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, text, 'utf8')
}

// ── 图片 ────────────────────────────────────────────────────────────────────

async function downloadImage({ raw, blockId, spaceId }) {
  const url = resolveDownloadUrl(raw, blockId, spaceId)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8'
      }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const length = Number(res.headers.get('content-length') || 0)
    if (length > MAX_IMAGE_BYTES) throw new Error(`too large ${length}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('too large')
    return { buffer, contentType: res.headers.get('content-type') || '' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 下载并回填图片，返回改写后的 recordMap
 */
async function localizeImages(recordMap, { enabled, cache }) {
  if (!enabled) return recordMap

  const sources = collectImageSources(recordMap)
  if (!sources.size) return recordMap

  const keyToPath = new Map()
  const tasks = []

  for (const [key, info] of sources) {
    if (cache.has(key)) {
      const cached = cache.get(key)
      // 上次就失败的（记为 false）不再重试，省得每篇都卡一次超时
      if (cached) keyToPath.set(key, cached)
      continue
    }
    tasks.push({ key, info })
  }

  let downloaded = 0
  let failed = 0
  const warned = new Set()

  await mapLimit(tasks, IMAGE_CONCURRENCY, async ({ key, info }) => {
    const ext = guessExt(info.raw, '')
    const fileName = `${sha1(key).slice(0, 20)}.${ext}`
    const absPath = path.join(IMAGE_DIR, fileName)
    const localPath = `/images/notion/${fileName}`

    if (!flags.dryRun && fs.existsSync(absPath)) {
      keyToPath.set(key, localPath)
      cache.set(key, localPath)
      return
    }

    try {
      const asset = await downloadImage(info)
      const finalName = `${sha1(key).slice(0, 20)}.${guessExt(
        info.raw,
        asset.contentType
      )}`
      const finalPath = path.join(IMAGE_DIR, finalName)
      if (!flags.dryRun) {
        await fsp.mkdir(IMAGE_DIR, { recursive: true })
        await fsp.writeFile(finalPath, asset.buffer)
      }
      const finalLocal = `/images/notion/${finalName}`
      keyToPath.set(key, finalLocal)
      cache.set(key, finalLocal)
      downloaded++
    } catch (error) {
      failed++
      cache.set(key, false)
      // 同一张图会在多篇文章里重复出现，只提示一次
      if (!warned.has(key)) {
        warned.add(key)
        console.warn('[sync] 图片下载失败，保留原地址:', key, error.message)
      }
    }
  })

  if (downloaded || failed) {
    log(`图片：新增 ${downloaded} 张，失败 ${failed} 张`)
  }

  return applyImageMap(recordMap, keyToPath)
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

function collectSitePageIds(recordMap) {
  const ids = new Set()
  const query = recordMap?.collection_query || {}
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node.blockIds)) node.blockIds.forEach(id => ids.add(id))
    if (Array.isArray(node)) node.forEach(walk)
    else Object.values(node).forEach(walk)
  }
  walk(query)
  return [...ids]
}

/**
 * 补齐站点 recordMap 里缺失的行 block。
 * 数据库行数一多，Notion 只返回一部分 block，缺的那批运行时就会去联网拉。
 */
async function hydrateRowBlocks(notion, recordMap, pageIds) {
  const missing = pageIds.filter(id => {
    const value = blockValue(recordMap.block?.[id])
    return !value || !value.properties
  })
  if (!missing.length) return 0

  for (let i = 0; i < missing.length; i += BLOCK_BATCH) {
    const batch = missing.slice(i, i + BLOCK_BATCH)
    try {
      const chunk = await notion.getBlocks(batch)
      Object.assign(recordMap.block, chunk?.recordMap?.block || {})
    } catch (error) {
      console.warn('[sync] 补拉 block 失败:', error.message)
    }
  }
  return missing.length
}

async function syncSite(notion, siteRawId, imageCache, { locale, slugProperty }) {
  const siteId = stripLocalePrefix(siteRawId)
  log(`站点 ${siteId}：拉取中`)
  const started = Date.now()
  const recordMap = await fetchPageWithRetry(notion, siteId)
  const pageIds = collectSitePageIds(recordMap)
  const filled = await hydrateRowBlocks(notion, recordMap, pageIds)
  log(
    `站点 ${siteId}：${Object.keys(recordMap.block || {}).length} 个 block，` +
      `${pageIds.length} 篇，补拉 ${filled} 篇，耗时 ${Date.now() - started}ms`
  )

  const titleKey = resolveTitleKey(recordMap)
  const slugKey = resolvePropertyKey(recordMap, slugProperty)
  const rows = pageIds.map(pageId => {
    const value = blockValue(recordMap.block?.[pageId])
    const slug = getPlainProperty(value, slugKey)
    return {
      id: pageId,
      title: getTitle(value, titleKey) || '',
      slug,
      lastEditedTime: value?.last_edited_time || 0
    }
  })

  const rewritten = await localizeImages(recordMap, {
    enabled: !flags.noImages,
    cache: imageCache
  })

  await writeJson(path.join(SITE_DIR, `${siteId}.json`), rewritten)

  return { siteId, pageIds, rows, recordMap: rewritten }
}

/**
 * 标题会重复（模板文章、空标题），文件名必须唯一且稳定。
 * 先沿用上次的文件名，再给新页面分配；冲突时补 id 前缀。
 */
function assignFileNames(rows, previousPages, used) {
  const result = new Map()

  for (const row of rows) {
    const previous = previousPages.get(row.id)
    if (previous?.file && !used.has(previous.file)) {
      used.add(previous.file)
      result.set(row.id, previous.file)
    }
  }

  for (const row of rows) {
    if (result.has(row.id)) continue
    const shortId = row.id.replace(/-/g, '').slice(0, 8)
    const base = sanitizeFileName(row.title, shortId)
    let name = base
    if (used.has(name)) name = `${base}-${shortId.slice(0, 6)}`
    let suffix = 2
    while (used.has(name)) name = `${base}-${shortId.slice(0, 6)}-${suffix++}`
    used.add(name)
    result.set(row.id, name)
  }

  return result
}

async function syncPost(notion, row, fileBase, previousEntry, imageCache) {
  const started = Date.now()
  // 文章正文不需要内嵌数据库，关掉 fetchCollections：
  // 省请求，同时避开 notion-utils 在 board/calendar 视图上 blockIds undefined 的坑
  const recordMap = await fetchPageWithRetry(notion, row.id, {
    fetchCollections: false
  })
  const value = blockValue(recordMap.block?.[row.id])
  const title = row.title || previousEntry?.title || row.id

  const rewritten = await localizeImages(recordMap, {
    enabled: !flags.noImages,
    cache: imageCache
  })

  const markdown = recordMapToMarkdown(rewritten, row.id, {
    title,
    slug: row.slug
  })

  await writeJson(path.join(PAGE_DIR, `${fileBase}.json`), rewritten)
  await writeText(path.join(PAGE_DIR, `${fileBase}.md`), markdown)

  return {
    id: row.id,
    file: fileBase,
    title,
    slug: row.slug || '',
    lastEditedTime: value?.last_edited_time || row.lastEditedTime || 0,
    updatedAt: new Date().toISOString(),
    bytes: markdown.length,
    ms: Date.now() - started
  }
}

async function main() {
  const BLOG = require(path.join(ROOT, 'blog.config.js'))
  const siteIds = String(BLOG.NOTION_PAGE_ID || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (!siteIds.length) {
    throw new Error('NOTION_PAGE_ID 为空，无法同步')
  }
  if (flags.dryRun) log('dry-run：只打印，不写文件')
  if (flags.force) log('force：忽略 lastEditedTime，全量重写')

  await fsp.mkdir(SITE_DIR, { recursive: true })
  await fsp.mkdir(PAGE_DIR, { recursive: true })

  const previousIndex = (await readJson(INDEX_FILE)) || { pages: [] }
  const previousPages = new Map(
    (previousIndex.pages || []).map(entry => [entry.id, entry])
  )
  const imageCache = new Map(
    Object.entries(previousIndex.images || {}).filter(
      ([, value]) => value !== null
    )
  )

  const notion = await createNotionClient()
  const sites = []
  const pages = []
  // 多语言站点之间标题会重复（About / 关于），文件名必须全局唯一
  const usedFiles = new Set()

  const defaultSlugProperty = BLOG.NOTION_PROPERTY_NAME?.slug || 'slug'

  for (const rawId of siteIds) {
    const locale = rawId.includes(':') ? rawId.split(':')[0] : BLOG.LANG
    const site = await syncSite(notion, rawId, imageCache, {
      locale,
      slugProperty: defaultSlugProperty
    })
    sites.push({ id: site.siteId, file: `${site.siteId}.json` })

    let rows = site.rows
    if (flags.limit) rows = rows.slice(0, flags.limit)

    const fileNames = assignFileNames(site.rows, previousPages, usedFiles)

    for (const row of rows) {
      const previous = previousPages.get(row.id)
      const fileBase = fileNames.get(row.id)

      const unchanged =
        !flags.force &&
        previous &&
        previous.lastEditedTime === row.lastEditedTime &&
        fs.existsSync(path.join(PAGE_DIR, `${fileBase}.json`))

      if (unchanged) {
        pages.push(previous)
        continue
      }

      try {
        const entry = await syncPost(
          notion,
          row,
          fileBase,
          previous,
          imageCache
        )
        pages.push(entry)
        log(`  ${entry.file} · ${entry.title} (${entry.ms}ms)`)
        await sleep(flags.interval)
      } catch (error) {
        console.warn('[sync] 文章同步失败:', row.id, error.message)
        // lastEditedTime 置 0：下次一定重试，不会被当成"已同步"跳过
        if (previous) pages.push({ ...previous, lastEditedTime: 0 })
      }
    }
  }

  const index = {
    generatedAt: new Date().toISOString(),
    sites,
    pages,
    images: Object.fromEntries(imageCache)
  }

  if (!flags.dryRun) {
    await writeJson(INDEX_FILE, index)
  }

  const stale = (previousIndex.pages || []).filter(
    old => !pages.some(entry => entry.id === old.id)
  )
  if (stale.length) {
    log(
      `有 ${stale.length} 篇已从 Notion 删除，content/pages 下的旧文件未自动清理：` +
        stale.map(entry => entry.file).join(', ')
    )
  }

  log(`完成：${sites.length} 个站点，${pages.length} 篇文章`)
}

main().catch(error => {
  console.error('[sync] 失败:', error)
  process.exit(1)
})
