/**
 * 日志统计读取与路径归一测试
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localstats-'))
const mockStatsFile = path.join(mockDir, 'stats.json')
let mockEnabled = true

jest.mock('@/blog.config', () => ({
  __esModule: true,
  get default() {
    return {
      ANALYTICS_STATS_ENABLE: mockEnabled,
      ANALYTICS_STATS_FILE: mockStatsFile
    }
  }
}))

const {
  getPageStats,
  getLocalStats,
  normalizeStatsPath
} = require('@/lib/analytics/local-stats')

function writeStats(payload) {
  fs.writeFileSync(mockStatsFile, JSON.stringify(payload))
}

describe('normalizeStatsPath', () => {
  test('去 query、去末尾斜杠', () => {
    expect(normalizeStatsPath('/article/a?v=1')).toBe('/article/a')
    expect(normalizeStatsPath('/article/a/')).toBe('/article/a')
    expect(normalizeStatsPath('/')).toBe('/')
    expect(normalizeStatsPath('')).toBe('/')
  })
})

describe('getPageStats', () => {
  beforeEach(() => {
    mockEnabled = true
    fs.rmSync(mockStatsFile, { force: true })
  })

  test('文件不存在时返回 null，不抛错', () => {
    expect(getLocalStats()).toBeNull()
    expect(getPageStats('/article/a')).toBeNull()
  })

  test('按路径返回页面 PV 与站点 PV/UV', () => {
    writeStats({
      version: 1,
      generatedAt: '2026-11-02T07:20:00.000Z',
      totals: { pv: 100, uv: 20 },
      pages: { '/article/a': 7 }
    })

    const got = getPageStats('/article/a?v=1')
    expect(got.pagePv).toBe(7)
    expect(got.sitePv).toBe(100)
    expect(got.siteUv).toBe(20)
    expect(got.generatedAt).toBe('2026-11-02T07:20:00.000Z')
  })

  test('未统计过的页面 pagePv 为 null，站点量照常返回', () => {
    writeStats({ totals: { pv: 5, uv: 2 }, pages: {} })
    const got = getPageStats('/article/unknown')
    expect(got.pagePv).toBeNull()
    expect(got.sitePv).toBe(5)
  })

  test('统计开关关闭时返回 null', () => {
    writeStats({ totals: { pv: 5, uv: 2 }, pages: {} })
    mockEnabled = false
    expect(getLocalStats()).toBeNull()
    mockEnabled = true
  })

  test('文件更新后能读到新值（mtime 缓存失效）', () => {
    writeStats({ totals: { pv: 1, uv: 1 }, pages: {} })
    expect(getPageStats('/').sitePv).toBe(1)

    writeStats({ totals: { pv: 2, uv: 2 }, pages: {} })
    // 显式改 mtime，避免同毫秒写入命中缓存
    const future = new Date(Date.now() + 5000)
    fs.utimesSync(mockStatsFile, future, future)

    expect(getPageStats('/').sitePv).toBe(2)
  })
})
