/**
 * 访问日志解析测试
 * 用真实 nginx combined / JSON 行跑端到端，检查过滤与聚合口径
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')

const SCRIPT = path.resolve(__dirname, '../../scripts/analytics/parse-access-log.js')

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'accesslog-'))
}

function combined(pathname, { ip = '1.1.1.1', ua = 'Mozilla/5.0 Chrome/126', status = 200 } = {}) {
  return `${ip} - - [02/Nov/2026:15:11:34 +0800] "GET ${pathname} HTTP/1.1" ${status} 1234 "https://www.junlin-233.top/" "${ua}"`
}

function run(logContent, extraArgs = []) {
  const dir = tmpDir()
  const logFile = path.join(dir, 'access.log')
  const out = path.join(dir, 'stats.json')
  fs.writeFileSync(logFile, logContent)
  execFileSync(process.execPath, [SCRIPT, '--log', logFile, '--out', out, '--quiet', ...extraArgs])
  return JSON.parse(fs.readFileSync(out, 'utf8'))
}

describe('parse-access-log', () => {
  test('统计文章页 PV，跳过静态资源与爬虫与错误码', () => {
    const log = [
      combined('/article/a'),
      combined('/article/a'),
      combined('/article/a'),
      combined('/_next/static/chunks/main.js'),
      combined('/css/style.css'),
      combined('/article/b', { status: 404 }),
      combined('/article/c', { ua: 'Googlebot/2.1' }),
      ''
    ].join('\n')

    const stats = run(log)

    expect(stats.totals.pv).toBe(3)
    expect(stats.pages['/article/a']).toBe(3)
    expect(stats.pages['/article/b']).toBeUndefined()
    expect(stats.pages['/article/c']).toBeUndefined()
    expect(stats.pages['/_next/static/chunks/main.js']).toBeUndefined()
    expect(stats.source.skipped.asset).toBe(2)
    expect(stats.source.skipped.bot).toBe(1)
    expect(stats.source.skipped.status).toBe(1)
  })

  test('同一天同 IP 同 UA 只算一个 UV', () => {
    const log = [
      combined('/article/a'),
      combined('/article/a'),
      combined('/article/b'),
      combined('/article/b', { ip: '2.2.2.2' }),
      ''
    ].join('\n')

    const stats = run(log)

    expect(stats.totals.pv).toBe(4)
    expect(stats.totals.uv).toBe(2)
    expect(stats.daily).toHaveLength(1)
    expect(stats.daily[0].date).toBe('2026-11-02')
    expect(stats.daily[0].uv).toBe(2)
  })

  test('query 与末尾斜杠归一，前缀可剥离', () => {
    const log = [
      combined('/article/a?v=1'),
      combined('/article/a/'),
      combined('/blog/article/b', {}),
      ''
    ].join('\n')

    const stats = run(log, ['--prefix', '/blog'])

    expect(stats.pages['/article/a']).toBe(2)
    expect(stats.pages['/article/b']).toBe(1)
  })

  test('支持 JSON 行日志（网关/Caddy 风格）', () => {
    const log = [
      JSON.stringify({
        remote_addr: '3.3.3.3',
        request_uri: '/article/json',
        http_user_agent: 'Mozilla/5.0 Chrome/126',
        status: 200,
        method: 'GET',
        time_iso8601: '2026-11-02T15:11:34+08:00'
      }),
      ''
    ].join('\n')

    const stats = run(log)

    expect(stats.totals.pv).toBe(1)
    expect(stats.pages['/article/json']).toBe(1)
    expect(stats.range.from).toBe('2026-11-02T07:11:34.000Z')
  })

  test('支持 gz 轮转日志', () => {
    const dir = tmpDir()
    const logFile = path.join(dir, 'access.log.1.gz')
    const out = path.join(dir, 'stats.json')
    fs.writeFileSync(logFile, zlib.gzipSync(combined('/article/gz')))

    execFileSync(process.execPath, [SCRIPT, '--log', logFile, '--out', out, '--quiet'])

    const stats = JSON.parse(fs.readFileSync(out, 'utf8'))
    expect(stats.pages['/article/gz']).toBe(1)
  })

  test('日志为空时不报错，输出 0', () => {
    const stats = run('')
    expect(stats.totals.pv).toBe(0)
    expect(stats.top).toEqual([])
  })
})
