/**
 * busuanzi 归档脚本测试
 * 重点：JSONP 解析要绕过 try{...}catch(e){} 的干扰；同日重跑覆盖并按天算增量
 */
const { parseJsonp, upsertPoint, todayInShanghai } = require('../../scripts/analytics/snapshot-busuanzi')

describe('parseJsonp', () => {
  test('解析 busuanzi 真实返回格式', () => {
    const raw =
      'try{bszArchive({"site_uv":898,"page_pv":876,"version":2.4,"site_pv":1318});}catch(e){}'
    expect(parseJsonp(raw)).toEqual({
      site_uv: 898,
      page_pv: 876,
      version: 2.4,
      site_pv: 1318
    })
  })

  test('尾部 catch 块不会被误当成 JSON', () => {
    const raw = 'try{cb({"a":1});}catch(e){}'
    expect(parseJsonp(raw)).toEqual({ a: 1 })
  })

  test('格式不对时抛错，不返回半截数据', () => {
    expect(() => parseJsonp('Bad Request')).toThrow('无法解析')
  })
})

describe('upsertPoint', () => {
  test('首条记录没有增量', () => {
    const points = upsertPoint({ points: [] }, '2026-11-02', {
      sitePv: 1319,
      siteUv: 898
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({
      date: '2026-11-02',
      sitePv: 1319,
      siteUv: 898,
      pvDelta: null,
      uvDelta: null
    })
  })

  test('按天相减得出增量', () => {
    let history = { points: [] }
    history.points = upsertPoint(history, '2026-11-01', { sitePv: 100, siteUv: 50 })
    history.points = upsertPoint(history, '2026-11-02', { sitePv: 130, siteUv: 61 })

    expect(history.points[1].pvDelta).toBe(30)
    expect(history.points[1].uvDelta).toBe(11)
  })

  test('同一天重复跑覆盖当天，不产生重复行', () => {
    let points = upsertPoint({ points: [] }, '2026-11-02', { sitePv: 1319, siteUv: 898 })
    points = upsertPoint({ points }, '2026-11-02', { sitePv: 1330, siteUv: 900 })

    expect(points).toHaveLength(1)
    expect(points[0].sitePv).toBe(1330)
  })

  test('乱序插入后仍按日期排序', () => {
    let points = upsertPoint({ points: [] }, '2026-11-03', { sitePv: 200, siteUv: 80 })
    points = upsertPoint({ points }, '2026-11-01', { sitePv: 100, siteUv: 50 })
    expect(points.map(p => p.date)).toEqual(['2026-11-01', '2026-11-03'])
  })

  test('累计值回退（busuanzi 重置）时增量不出现负数', () => {
    let points = upsertPoint({ points: [] }, '2026-11-01', { sitePv: 500, siteUv: 200 })
    points = upsertPoint({ points }, '2026-11-02', { sitePv: 10, siteUv: 5 })
    expect(points[1].pvDelta).toBe(0)
    expect(points[1].uvDelta).toBe(0)
  })
})

describe('todayInShanghai', () => {
  test('输出 YYYY-MM-DD', () => {
    expect(todayInShanghai()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
