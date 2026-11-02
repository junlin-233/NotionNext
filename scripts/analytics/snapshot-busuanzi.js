#!/usr/bin/env node
/**
 * busuanzi 累计值归档（补历史数据）
 *
 * 背景：
 *   busuanzi 只暴露「当前累计值」，没有历史、没有 API 文档。
 *   所以定时抓一次累计值存下来，相邻两天相减就是当天增量。
 *
 * 用法：
 *   node scripts/analytics/snapshot-busuanzi.js
 *   node scripts/analytics/snapshot-busuanzi.js --origin https://www.junlin-233.top
 *   node scripts/analytics/snapshot-busuanzi.js --date 2026-11-02 --dry-run
 *
 * ⚠️ 抓取本身会被 busuanzi 计入一次访问：
 *   - site_pv 每次 +1（无法避免，一天抓一次可忽略）
 *   - site_uv 靠 cookie 去重，所以这里固定发同一个 busuanziId，UV 不会被虚增
 *   不要提高抓取频率，也不要抓页面级 PV（每个页面 +1，几百页会把数据搅烂）
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_OUT = path.join(ROOT, 'analytics', 'history.json')
const ENDPOINT = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback=bszArchive'
// 固定身份，让 busuanzi 把每次抓取都当成同一个访客
const ARCHIVE_COOKIE = 'busuanziId=notionnext-archive-cron'
const ARCHIVE_UA = 'Mozilla/5.0 (compatible; NotionNextStats/1.0)'

function parseArgs(argv) {
  const opts = {
    origin: process.env.SITE_ORIGIN || 'https://www.junlin-233.top',
    out: process.env.ANALYTICS_HISTORY_FILE
      ? path.resolve(process.env.ANALYTICS_HISTORY_FILE)
      : DEFAULT_OUT,
    date: '',
    dryRun: false
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--origin') opts.origin = next()
    else if (arg === '--out') opts.out = path.resolve(next())
    else if (arg === '--date') opts.date = next()
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      process.exit(0)
    }
  }
  return opts
}

/** 业务日期按北京时间算，避免 UTC 跨天把两天数据并成一天 */
function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/**
 * JSONP: try{bszArchive({"site_uv":895,...});}catch(e){}
 * 注意尾部还有一个 catch(e){}，不能用 lastIndexOf('}')，要按括号配对取第一个对象
 */
function parseJsonp(text) {
  // 注意 try{callback(...)} 里第一个 { 是函数体，JSON 在 '(' 之后的第一个 '{'
  const paren = text.indexOf('(')
  const start = paren < 0 ? -1 : text.indexOf('{', paren + 1)
  if (start < 0) throw new Error(`无法解析 busuanzi 返回: ${text.slice(0, 120)}`)

  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error(`busuanzi 返回不是完整对象: ${text.slice(0, 120)}`)
}

async function fetchBusuanzi(origin) {
  const res = await fetch(ENDPOINT, {
    headers: {
      Referer: `${origin.replace(/\/$/, '')}/`,
      Cookie: ARCHIVE_COOKIE,
      'User-Agent': ARCHIVE_UA,
      Accept: '*/*'
    }
  })

  if (!res.ok) {
    throw new Error(`busuanzi 返回 HTTP ${res.status}`)
  }

  const data = parseJsonp(await res.text())
  if (typeof data.site_pv !== 'number' || typeof data.site_uv !== 'number') {
    throw new Error(`busuanzi 字段异常: ${JSON.stringify(data)}`)
  }
  return { sitePv: data.site_pv, siteUv: data.site_uv }
}

function readHistory(file) {
  if (!fs.existsSync(file)) {
    return { version: 1, updatedAt: null, points: [] }
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(parsed.points)) parsed.points = []
  return parsed
}

/**
 * 同一天重复跑就覆盖当天那条（取当天最后一次读数），并重算增量
 */
function upsertPoint(history, date, reading) {
  const points = history.points.filter(p => p.date !== date)
  points.push({ date, ...reading })
  points.sort((a, b) => (a.date < b.date ? -1 : 1))

  return points.map((p, i) => {
    const prev = points[i - 1]
    return {
      ...p,
      pvDelta: prev ? Math.max(0, p.sitePv - prev.sitePv) : null,
      uvDelta: prev ? Math.max(0, p.siteUv - prev.siteUv) : null
    }
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const date = opts.date || todayInShanghai()

  const reading = await fetchBusuanzi(opts.origin)
  const history = readHistory(opts.out)
  const points = upsertPoint(history, date, reading)

  const output = {
    version: 1,
    source: 'busuanzi',
    note: 'sitePv/siteUv 为 busuanzi 累计值；pvDelta/uvDelta 由相邻两天相减得出，归档首日为空',
    updatedAt: new Date().toISOString(),
    points
  }

  const latest = points[points.length - 1]

  if (opts.dryRun) {
    console.log('[archive] dry-run，未写入')
  } else {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true })
    const tmp = `${opts.out}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(output, null, 1))
    fs.renameSync(tmp, opts.out)
    console.log(`[archive] 写入 ${opts.out}`)
  }

  console.log(
    `[archive] ${latest.date} 累计 PV ${latest.sitePv} / UV ${latest.siteUv}` +
      (latest.pvDelta === null
        ? '（首条记录，无增量）'
        : `，日增 PV ${latest.pvDelta} / UV ${latest.uvDelta}`)
  )
  console.log(`[archive] 共 ${points.length} 天记录`)
}

if (require.main === module) {
  main().catch(e => {
    console.error('[archive] 失败:', e.message)
    process.exit(1)
  })
}

module.exports = { parseJsonp, upsertPoint, todayInShanghai, readHistory }
