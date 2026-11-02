#!/usr/bin/env node
/**
 * 构建 Pagefind 搜索索引
 *
 * 两种模式：
 * - crawl（默认）：启动服务器，从 sitemap 抓全量 HTML 再索引。
 *   优点：覆盖所有路由（文章 + 标签 + 分类 + 归档），URL 一定和线上一致；
 *   代价：要跑起服务、要预热 ISR，几分钟。
 * - md（--source=md）：直接读 content 目录下的 markdown 生成 HTML stub 再索引。
 *   优点：秒级、不依赖运行时；内容源切到 git 后尤其顺。
 *   代价：只索引文章正文（标签/分类页不进索引），URL 取 md front matter 的 url。
 *
 * 用法：
 *   node scripts/build-search-index.js                  # 爬取模式，默认 3939 端口
 *   node scripts/build-search-index.js --source=md       # markdown 模式
 *   node scripts/build-search-index.js --port 4000
 *   node scripts/build-search-index.js --keep-cache
 *   node scripts/build-search-index.js --concurrency 4
 */

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(ROOT, '.pagefind-cache')
const BUNDLE_DIR = path.join(ROOT, 'public', 'pagefind')
const CONTENT_DIR = path.join(ROOT, 'content')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i > -1 && args[i + 1] ? args[i + 1] : fallback
}
const hasFlag = name => args.includes(`--${name}`)

const PORT = Number(getArg('port', 3939))
const CONCURRENCY = Number(getArg('concurrency', 4))
const KEEP_CACHE = hasFlag('keep-cache')
const SOURCE = getArg('source', 'crawl')
const BASE = `http://127.0.0.1:${PORT}`

const log = msg => console.log(`[search-index] ${msg}`)

function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`服务器在 ${timeoutMs}ms 内未就绪`))
        return
      }
      try {
        const res = await fetch(url, { method: 'HEAD' })
        if (res.ok || res.status === 404) {
          resolve()
          return
        }
      } catch (e) {
        // 未就绪，继续等待
      }
      setTimeout(() => {
        void tick()
      }, 1000)
    }
    void tick()
  })
}

function startServer() {
  const standaloneServer = path.join(ROOT, '.next', 'standalone', 'server.js')
  const isStandalone = fs.existsSync(standaloneServer)

  log(
    `启动生产服务器（${isStandalone ? 'standalone' : 'next start'}），端口 ${PORT}`
  )

  const child = isStandalone
    ? spawn('node', [standaloneServer], {
        cwd: path.join(ROOT, '.next', 'standalone'),
        env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1' },
        stdio: 'ignore'
      })
    : spawn('npx', ['next', 'start', '-p', String(PORT)], {
        cwd: ROOT,
        env: { ...process.env },
        stdio: 'ignore',
        shell: true
      })

  child.on('error', err => {
    console.error('[search-index] 服务器启动失败:', err)
  })

  return child
}

async function getSitemapUrls() {
  const res = await fetch(`${BASE}/sitemap.xml`)
  if (!res.ok) {
    throw new Error(`读取 sitemap 失败: HTTP ${res.status}`)
  }
  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  // sitemap 里是线上域名，替换为本地地址抓取
  return urls.map(u => {
    const pathname = new URL(u).pathname
    return `${BASE}${pathname}`
  })
}

async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.text()
  } catch (e) {
    log(`抓取失败 ${url}: ${e.message}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function crawl(urls) {
  fs.rmSync(CACHE_DIR, { recursive: true, force: true })
  fs.mkdirSync(CACHE_DIR, { recursive: true })

  let done = 0
  let failed = 0

  const writePage = (url, html) => {
    const pathname = new URL(url).pathname
    const dir = path.join(CACHE_DIR, pathname)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), html)
  }

  // 简单并发池
  const queue = [...urls]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const url = queue.shift()
      const html = await fetchPage(url)
      if (html) {
        writePage(url, html)
      } else {
        failed++
      }
      done++
      if (done % 10 === 0 || done === urls.length) {
        log(`已抓取 ${done}/${urls.length}${failed ? `（失败 ${failed}）` : ''}`)
      }
    }
  })

  await Promise.all(workers)
  return { done, failed }
}

function runPagefind() {
  log('运行 pagefind 生成索引...')
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true })

  const result = spawnSync(
    'npx',
    [
      '--yes',
      // 锁版本：pagefind 1.6 起 --source/--bundle-path 改名为 --site/--output-path
      'pagefind@1.6.0',
      '--site',
      path.relative(ROOT, CACHE_DIR) || '.',
      '--output-path',
      path.relative(ROOT, BUNDLE_DIR) || 'public/pagefind',
      '--force-language',
      'zh',
      // 去掉站内导航/页脚/侧栏等重复文本，避免污染搜索摘要
      '--exclude-selectors',
      'nav,footer,header,aside,script,style,.no-search'
    ],
    { cwd: ROOT, stdio: 'inherit', shell: true }
  )

  if (result.status !== 0) {
    throw new Error(`pagefind 执行失败，退出码 ${result.status}`)
  }
}

/**
 * markdown 模式：从 content 生成 stub HTML
 * Pagefind 需要一个目录里的 HTML 文件来推断 URL，所以按文章 url 建目录、写 index.html
 */
/**
 * 真实文章地址优先从 sitemap.xml 取（里面是线上实际路由），
 * 匹配不上再退回 /<locale>/<slug>。站点用 URL_PREFIX 拼前缀，这里不复制那套规则。
 */
function loadUrlIndex() {
  const map = new Map()
  const file = path.join(ROOT, 'public', 'sitemap.xml')
  if (!fs.existsSync(file)) return map
  const xml = fs.readFileSync(file, 'utf8')
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      const pathname = new URL(match[1]).pathname.replace(/\/+$/, '')
      const parts = pathname.split('/').filter(Boolean)
      for (let i = 1; i < parts.length; i++) {
        // 以 slug 结尾的地址全部登记，key 取尾部若干段
        map.set(parts.slice(-i).join('/'), pathname)
      }
    } catch (e) {
      // 非法 URL 忽略
    }
  }
  return map
}

function resolveUrl(page, urlIndex) {
  const slug = (page.slug || '').replace(/^\/+/, '')
  if (slug && urlIndex.has(slug)) return urlIndex.get(slug)
  if (slug) return `/${slug}`
  return ''
}

function buildStubsFromContent() {
  const indexFile = path.join(CONTENT_DIR, 'index.json')
  if (!fs.existsSync(indexFile)) {
    throw new Error('content/index.json 不存在，先跑 yarn sync:content')
  }
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
  const pages = index.pages || []
  const urlIndex = loadUrlIndex()

  fs.rmSync(CACHE_DIR, { recursive: true, force: true })
  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const escapeHtml = str =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const stripFrontMatter = text =>
    text.startsWith('---')
      ? text.replace(/^---\n[\s\S]*?\n---\n/, '')
      : text

  let written = 0
  let skipped = 0

  for (const page of pages) {
    const mdFile = path.join(CONTENT_DIR, 'pages', `${page.file}.md`)
    if (!fs.existsSync(mdFile)) {
      skipped++
      continue
    }
    const raw = fs.readFileSync(mdFile, 'utf8')
    const body = stripFrontMatter(raw)
    const url = resolveUrl(page, urlIndex)
    // url 形如 /zh-CN/article/xxx，落成目录结构
    const routePath = url.replace(/^\/+|\/+$/g, '')
    if (!routePath) {
      skipped++
      continue
    }
    const dir = path.join(CACHE_DIR, routePath)
    fs.mkdirSync(dir, { recursive: true })
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(
      page.title || page.slug || page.file
    )}</title></head><body><article data-pagefind-body><h1>${escapeHtml(
      page.title || ''
    )}</h1><pre>${escapeHtml(body)}</pre></article></body></html>`
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    written++
  }

  log(`markdown 模式：生成 ${written} 个 stub${skipped ? `，跳过 ${skipped} 个` : ''}`)
  return written
}

async function main() {
  const useMdMode = SOURCE === 'md'

  if (useMdMode) {
    const count = buildStubsFromContent()
    if (!count) throw new Error('content 目录没有可索引的文章')
    runPagefind()
    const files = fs.readdirSync(BUNDLE_DIR)
    log(`索引生成完成：public/pagefind/（${files.length} 个文件）`)
    return
  }

  if (fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID')) === false) {
    console.error(
      '[search-index] 未找到 .next/BUILD_ID，请先执行 yarn build'
    )
    process.exit(1)
  }

  const server = startServer()

  try {
    await waitForServer(`${BASE}/`)
    log('服务器就绪，读取 sitemap...')

    const urls = await getSitemapUrls()
    log(`共 ${urls.length} 个页面待索引`)

    await crawl(urls)
    runPagefind()

    const files = fs.readdirSync(BUNDLE_DIR)
    log(`索引生成完成：public/pagefind/（${files.length} 个文件）`)
  } finally {
    server.kill()
    if (!KEEP_CACHE) {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true })
    }
  }
}

main().catch(err => {
  console.error('[search-index] 构建失败:', err)
  process.exit(1)
})
