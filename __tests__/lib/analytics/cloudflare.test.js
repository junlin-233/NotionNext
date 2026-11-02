/**
 * Cloudflare Web Analytics 取数测试
 * 用真实响应结构（rumPageloadEventsAdaptiveGroups）验证映射，不打真接口
 */
const mockBlog = {
  CLOUDFLARE_API_TOKEN: 'test-token',
  CLOUDFLARE_ACCOUNT_ID: 'acc-1',
  CLOUDFLARE_SITE_TAG: 'site-1'
}

jest.mock('@/blog.config', () => ({
  __esModule: true,
  get default() {
    return mockBlog
  }
}))

const {
  fetchCloudflareStats,
  getCloudflarePageStats,
  isCloudflareConfigured,
  mapToStats,
  resetCacheForTest
} = require('@/lib/analytics/cloudflare')

const okResponse = {
  data: {
    viewer: {
      accounts: [
        {
          daily: [
            {
              count: 120,
              sum: { visits: 80 },
              avg: { sampleInterval: 1 },
              dimensions: { date: '2026-11-01' }
            },
            {
              count: 30,
              sum: { visits: 20 },
              avg: { sampleInterval: 1 },
              dimensions: { date: '2026-11-02' }
            }
          ],
          pages: [
            { count: 90, sum: { visits: 60 }, dimensions: { requestPath: '/article/a' } },
            { count: 40, sum: { visits: 30 }, dimensions: { requestPath: '/' } },
            { count: 5, sum: { visits: 5 }, dimensions: { requestPath: '/article/b' } }
          ]
        }
      ]
    }
  },
  errors: null
}

function mockFetch(payload, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload)
  })
}

describe('cloudflare analytics', () => {
  beforeEach(() => {
    mockBlog.CLOUDFLARE_API_TOKEN = 'test-token'
    resetCacheForTest()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('mapToStats 汇总 PV/UV/日序列/页面', () => {
    const stats = mapToStats(okResponse.data.viewer.accounts[0], 30)

    expect(stats.totals.pv).toBe(150)
    expect(stats.totals.uv).toBe(100)
    expect(stats.daily).toEqual([
      { date: '2026-11-01', pv: 120, uv: 80 },
      { date: '2026-11-02', pv: 30, uv: 20 }
    ])
    expect(stats.pages['/article/a']).toBe(90)
    expect(stats.top[0]).toEqual({ path: '/article/a', pv: 90 })
    expect(stats.range).toEqual({ from: '2026-11-01', to: '2026-11-02' })
    expect(stats.source.provider).toBe('cloudflare-web-analytics')
  })

  test('拿到数据后按路径返回页面 PV 与站点总量', async () => {
    mockFetch(okResponse)
    const got = await getCloudflarePageStats('/article/a?v=1')
    expect(got.pagePv).toBe(90)
    expect(got.sitePv).toBe(150)
    expect(got.siteUv).toBe(100)
  })

  test('未统计过的页面返回 pagePv null', async () => {
    mockFetch(okResponse)
    const got = await getCloudflarePageStats('/article/unknown')
    expect(got.pagePv).toBeNull()
  })

  test('GraphQL 返回 errors 时抛错，不静默当作 0', async () => {
    mockFetch({ data: null, errors: [{ message: 'not authorized' }] })
    await expect(fetchCloudflareStats({ days: 7 })).rejects.toThrow(
      'not authorized'
    )
  })

  test('未配置时不发请求，直接返回 null', async () => {
    mockBlog.CLOUDFLARE_API_TOKEN = ''
    global.fetch = jest.fn()
    expect(isCloudflareConfigured()).toBe(false)
    await expect(fetchCloudflareStats()).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
