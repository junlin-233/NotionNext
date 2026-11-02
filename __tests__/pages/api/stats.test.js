/**
 * /api/stats 数据源切换测试
 * 无 Umami 配置时应走访问日志统计，返回与前端约定的结构
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apistats-'))
const mockStatsFile = path.join(mockDir, 'stats.json')

jest.mock('@/blog.config', () => ({
  __esModule: true,
  default: {
    ANALYTICS_STATS_ENABLE: true,
    ANALYTICS_STATS_FILE: mockStatsFile,
    UMAMI_HOST: '',
    UMAMI_ID: '',
    UMAMI_API_TOKEN: '',
    UMAMI_STATS_SINCE: 0
  }
}))

const handler = require('@/pages/api/stats').default

function mockRes() {
  const res = {
    statusCode: null,
    body: undefined,
    ended: false,
    setHeader: jest.fn(),
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
    end() {
      this.ended = true
      return this
    }
  }
  return res
}

describe('/api/stats', () => {
  beforeEach(() => {
    fs.rmSync(mockStatsFile, { force: true })
  })

  test('有统计文件时返回页面 PV 与站点 PV/UV', async () => {
    fs.writeFileSync(
      mockStatsFile,
      JSON.stringify({
        version: 1,
        generatedAt: '2026-11-02T07:20:00.000Z',
        totals: { pv: 21338, uv: 4127 },
        pages: { '/article/notionnext': 42 }
      })
    )

    const res = mockRes()
    await handler({ method: 'GET', query: { path: '/article/notionnext' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      pagePv: 42,
      sitePv: 21338,
      siteUv: 4127,
      generatedAt: '2026-11-02T07:20:00.000Z'
    })
  })

  test('没有统计文件时返回 204，前端静默隐藏', async () => {
    const res = mockRes()
    await handler({ method: 'GET', query: { path: '/article/x' } }, res)
    expect(res.statusCode).toBe(204)
    expect(res.ended).toBe(true)
  })

  test('非 GET 返回 405', async () => {
    const res = mockRes()
    await handler({ method: 'POST', query: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})
