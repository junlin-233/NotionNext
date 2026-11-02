#!/usr/bin/env node
/**
 * 构建 Pagefind 搜索索引（预热爬取方案）
 *
 * 背景：站点是 ISR 渲染，没有全量预渲染 HTML，Pagefind 无法直接索引。
 * 做法：
 *   1. 启动生产服务器（standalone 或 next start）
 *   2. 读取 /sitemap.xml 得到全部 URL（此步同时把 ISR 页面全部预热）
 *   3. 并发抓取每页 HTML 到 .pagefind-cache/
 *   4. 运行 pagefind 生成索引到 public/pagefind/
 *
 * 用法：
 *   node scripts/build-search-index.js            # 默认 3939 端口
 *   node scripts/build-search-index.js --port 4000
 *   node scripts/build-search-index.js --keep-cache   # 保留临时 HTML
 *   node scripts/build-search-index.js --concurrency 4
 */

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(ROOT, '.pagefind-cache')
const BUNDLE_DIR = path.join(ROOT, 'public', 'pagefind')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i > -1 && args[i + 1] ? args[i + 1] : fallback
}
const hasFlag = name => args.includes(`--${name}`)

const PORT = Number(getArg('port', 3939))
const CONCURRENCY = Number(getArg('concurrency', 4))
const KEEP_CACHE = hasFlag('keep-cache')
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

async function main() {
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
