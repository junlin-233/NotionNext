#!/usr/bin/env node
/**
 * 访问日志统计（替代 Umami / busuanzi）
 *
 * 输入：Nginx / Caddy / 网关的 access log（支持 gzip 历史轮转文件）
 * 输出：一份 JSON 汇总，站点 /api/stats 读它展示阅读数
 *
 * 用法：
 *   node scripts/analytics/parse-access-log.js
 *   node scripts/analytics/parse-access-log.js --log /var/log/nginx/access.log
 *   node scripts/analytics/parse-access-log.js --log "/var/log/nginx/access.log*" --out ./analytics/stats.json
 *   node scripts/analytics/parse-access-log.js --since 2026-01-01 --format combined
 *
 * 常用参数：
 *   --log <path>      日志文件，支持通配符，可重复；默认取 env ACCESS_LOG_PATH
 *   --out <path>      输出路径，默认 env ANALYTICS_STATS_FILE 或 .analytics/stats.json
 *   --format <fmt>    auto | combined | json，默认 auto（逐行判断）
 *   --since <date>    只统计该日期（YYYY-MM-DD）之后
 *   --prefix <path>   站点部署在子路径时，统计前先剥掉该前缀
 *   --keep-bots       不按 UA 过滤爬虫（默认过滤）
 *   --quiet           不打印汇总
 *
 * 隐私：不落原始 IP，UV 用 sha256(salt + ip + ua + 日期) 前缀，只用于当日去重。
 */

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '..', '..')

const ASSET_EXT =
  /\.(css|js|mjs|map|json|xml|txt|ico|png|jpe?g|gif|svg|webp|avif|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|zip|pdf)$/i

const SKIP_PREFIX = [
  '/_next/',
  '/api/',
  '/pagefind/',
  '/_vercel/',
  '/static/',
  '/assets/',
  '/fonts/',
  '/images/',
  '/img/',
  '/feed',
  '/rss'
]

// 常见爬虫与预取；宁可漏杀，也不能把真人当爬虫
const BOT_UA =
  /(bot|crawler|spider|slurp|curl|wget|python-requests|python-urllib|go-http-client|headlesschrome|phantomjs|monitor|uptime|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|bingpreview|yandex|baiduspider|sogou|bytespider|petalbot|semrush|ahrefs|mj12|dotbot)/i

const COMBINED =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/
const COMMON = /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)/

const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
}

function parseArgs(argv) {
  const opts = {
    logs: [],
    out: process.env.ANALYTICS_STATS_FILE
      ? path.resolve(process.env.ANALYTICS_STATS_FILE)
      : path.join(ROOT, '.analytics', 'stats.json'),
    format: 'auto',
    since: '',
    prefix: '',
    keepBots: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--log') opts.logs.push(next())
    else if (arg === '--out') opts.out = path.resolve(next())
    else if (arg === '--format') opts.format = next()
    else if (arg === '--since') opts.since = next()
    else if (arg === '--prefix') opts.prefix = next()
    else if (arg === '--keep-bots') opts.keepBots = true
    else if (arg === '--quiet') opts.quiet = true
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
      process.exit(0)
    }
  }

  if (opts.logs.length === 0) {
    opts.logs.push(process.env.ACCESS_LOG_PATH || '/var/log/nginx/access.log')
  }
  return opts
}

function expandLogs(patterns) {
  const files = []
  for (const p of patterns) {
    // 支持 shell 风格通配：access.log* 覆盖 access.log.1 / .2.gz
    if (p.includes('*')) {
      const dir = path.dirname(p)
      const base = path.basename(p)
      const re = new RegExp(
        '^' +
          base
            .split('*')
            .map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$'
      )
      let entries = []
      try {
        entries = fs.readdirSync(dir)
      } catch (e) {
        console.warn(`[stats] 目录不可读，跳过: ${dir}`)
        continue
      }
      entries
        .filter(f => re.test(f))
        .sort()
        .forEach(f => files.push(path.join(dir, f)))
    } else if (fs.existsSync(p)) {
      files.push(p)
    }
  }
  return files
}

function readLines(file) {
  const raw = fs.readFileSync(file)
  const buf = file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw
  return buf.toString('utf8').split('\n')
}

/** 02/Nov/2026:15:11:34 +0800 -> Date */
function parseNginxTime(str) {
  const m = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(
    str.trim()
  )
  if (!m) return null
  const [, dd, mon, yyyy, hh, mm, ss, tz] = m
  if (MONTHS[mon] === undefined) return null
  const iso = `${yyyy}-${String(MONTHS[mon] + 1).padStart(2, '0')}-${dd}T${hh}:${mm}:${ss}${tz.slice(0, 3)}:${tz.slice(3)}`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizePath(uri, prefix) {
  let p = uri.split('?')[0].split('#')[0]
  if (!p.startsWith('/')) {
    try {
      p = new URL(p).pathname
    } catch (e) {
      return null
    }
  }
  if (prefix && p.startsWith(prefix)) {
    p = p.slice(prefix.length) || '/'
  }
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '')
  return p || '/'
}

function shouldSkipPath(p) {
  if (!p) return true
  if (ASSET_EXT.test(p)) return true
  return SKIP_PREFIX.some(prefix => p.startsWith(prefix))
}

function visitorHash(salt, ip, ua, day) {
  return crypto
    .createHash('sha256')
    .update(`${salt}|${ip}|${ua}|${day}`)
    .digest('hex')
    .slice(0, 16)
}

function extractFromJson(obj) {
  const ip = obj.remote_addr || obj.ip || obj.client_ip || obj.ClientIP || ''
  const ua =
    obj.http_user_agent || obj.user_agent || obj.ua || obj.UserAgent || ''
  const uri =
    obj.request_uri ||
    obj.uri ||
    obj.path ||
    obj.Path ||
    (typeof obj.request === 'string'
      ? obj.request.split(' ')[1] || ''
      : '') ||
    ''
  const status = Number(
    obj.status || obj.Status || obj.status_code || obj.response_status || 200
  )
  const method =
    obj.request_method ||
    obj.method ||
    obj.Method ||
    (typeof obj.request === 'string' ? obj.request.split(' ')[0] : 'GET')
  const timeRaw =
    obj.time_iso8601 ||
    obj.time ||
    obj.timestamp ||
    obj.ts ||
    obj.Time ||
    obj.time_local

  let when = null
  if (typeof timeRaw === 'number') {
    when = new Date(timeRaw < 1e12 ? timeRaw * 1000 : timeRaw)
  } else if (typeof timeRaw === 'string') {
    when = timeRaw.includes('/')
      ? parseNginxTime(timeRaw)
      : new Date(timeRaw.replace(' ', 'T'))
  }
  if (!when || Number.isNaN(when.getTime())) when = null

  return { ip, ua, uri, status, method, when }
}

function parseLine(line, format) {
  if (!line || line.length < 10) return null
  const trimmed = line.trim()

  if (format === 'auto' || format === 'json') {
    if (trimmed.startsWith('{')) {
      try {
        const info = extractFromJson(JSON.parse(trimmed))
        if (info.uri) return info
      } catch (e) {
        return null
      }
    }
    if (format === 'json') return null
  }

  const m = COMBINED.exec(trimmed) || COMMON.exec(trimmed)
  if (!m) return null

  const [, ip, timeStr, request, statusStr, , referer, ua] = m
  const [method, uri] = (request || '').split(' ')
  return {
    ip,
    ua: ua || '',
    uri: uri || '',
    status: Number(statusStr),
    method: method || 'GET',
    when: parseNginxTime(timeStr),
    referer
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const files = expandLogs(opts.logs)

  if (files.length === 0) {
    console.error(
      `[stats] 没找到日志文件：${opts.logs.join(', ')}\n` +
        '        用 --log 指定，或设置环境变量 ACCESS_LOG_PATH'
    )
    process.exit(1)
  }

  const since = opts.since ? new Date(`${opts.since}T00:00:00`) : null
  const salt = process.env.ANALYTICS_SALT || 'notionnext-stats'

  const pages = new Map()
  const daily = new Map() // date -> { pv, uv:Set }
  const allVisitors = new Set()
  const skipped = { asset: 0, bot: 0, status: 0, method: 0, unparsed: 0, since: 0 }

  let totalLines = 0
  let counted = 0
  let minTs = null
  let maxTs = null

  for (const file of files) {
    let lines
    try {
      lines = readLines(file)
    } catch (e) {
      console.warn(`[stats] 读取失败，跳过 ${file}: ${e.message}`)
      continue
    }

    for (const line of lines) {
      totalLines++
      const info = parseLine(line, opts.format)
      if (!info) {
        skipped.unparsed++
        continue
      }
      if (!info.uri) {
        skipped.unparsed++
        continue
      }
      if (info.method !== 'GET' && info.method !== 'HEAD') {
        skipped.method++
        continue
      }
      if (!info.status || info.status >= 400) {
        skipped.status++
        continue
      }
      if (!opts.keepBots && BOT_UA.test(info.ua)) {
        skipped.bot++
        continue
      }

      const p = normalizePath(info.uri, opts.prefix)
      if (shouldSkipPath(p)) {
        skipped.asset++
        continue
      }

      const when = info.when || null
      if (since && when && when < since) {
        skipped.since++
        continue
      }

      const day = when ? when.toISOString().slice(0, 10) : 'unknown'
      const visitor = visitorHash(salt, info.ip, info.ua, day)

      pages.set(p, (pages.get(p) || 0) + 1)
      allVisitors.add(visitor)

      const entry = daily.get(day) || { pv: 0, uv: new Set() }
      entry.pv++
      entry.uv.add(visitor)
      daily.set(day, entry)

      counted++
      if (when) {
        const ts = when.getTime()
        if (minTs === null || ts < minTs) minTs = ts
        if (maxTs === null || ts > maxTs) maxTs = ts
      }
    }
  }

  const dailyArr = [...daily.entries()]
    .filter(([d]) => d !== 'unknown')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, pv: v.pv, uv: v.uv.size }))

  const pageEntries = [...pages.entries()].sort((a, b) => b[1] - a[1])

  const stats = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      files: files.map(f => path.basename(f)),
      lines: totalLines,
      counted,
      skipped
    },
    range: {
      from: minTs ? new Date(minTs).toISOString() : null,
      to: maxTs ? new Date(maxTs).toISOString() : null
    },
    totals: { pv: counted, uv: allVisitors.size },
    daily: dailyArr,
    pages: Object.fromEntries(pageEntries),
    top: pageEntries.slice(0, 50).map(([p, pv]) => ({ path: p, pv }))
  }

  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  const tmp = `${opts.out}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(stats, null, 1))
  fs.renameSync(tmp, opts.out)

  if (!opts.quiet) {
    console.log(
      `[stats] ${files.length} 个文件 / ${totalLines} 行，计入 ${counted} 次访问`
    )
    console.log(
      `[stats] PV ${stats.totals.pv} · UV ${stats.totals.uv} · 页面 ${pageEntries.length} 个`
    )
    console.log(
      `[stats] 跳过：静态资源 ${skipped.asset} · 爬虫 ${skipped.bot} · 非 2xx ${skipped.status} · 非 GET ${skipped.method} · 无法解析 ${skipped.unparsed}`
    )
    console.log(`[stats] 输出 ${opts.out}`)
  }
}

if (require.main === module) {
  main()
}

module.exports = { parseLine, normalizePath, shouldSkipPath, parseNginxTime }
