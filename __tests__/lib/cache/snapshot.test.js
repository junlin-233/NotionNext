/**
 * 快照降级层测试（P2.1）
 * 验证：成功写入 → 拉取失败时降级读取 → 空结果不污染缓存
 */
const path = require('path')
const fs = require('fs')
const os = require('os')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-test-'))
process.env.SNAPSHOT_DIR = tmpDir

jest.mock('@/blog.config', () => ({
  __esModule: true,
  default: { ENABLE_CACHE: true, REDIS_URL: '', isProd: true }
}))

const { getSnapshot, setSnapshot, hasSnapshot } = require('@/lib/cache/snapshot_store')
const {
  getOrSetDataWithCache
} = require('@/lib/cache/cache_manager')

describe('snapshot_store', () => {
  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  test('写入后可按同一 key 读回，并带 savedAt', () => {
    const payload = { allPages: [{ slug: 'a' }] }
    expect(setSnapshot('site_demo', payload)).toBe(true)
    expect(hasSnapshot('site_demo')).toBe(true)

    const got = getSnapshot('site_demo')
    expect(got.data).toEqual(payload)
    expect(typeof got.savedAt).toBe('string')
  })

  test('不存在的 key 返回 null', () => {
    expect(getSnapshot('site_missing')).toBeNull()
  })

  test('key 含特殊字符也不冲突', () => {
    setSnapshot('page_block/abc-123/x', { a: 1 })
    setSnapshot('page_block/abc-123/y', { a: 2 })
    expect(getSnapshot('page_block/abc-123/x').data).toEqual({ a: 1 })
    expect(getSnapshot('page_block/abc-123/y').data).toEqual({ a: 2 })
  })
})

describe('cache_manager 降级', () => {
  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  test('真实拉取成功时写快照', async () => {
    const key = `site_happy_${process.pid}_${Date.now()}`
    const data = { postCount: 3 }
    await getOrSetDataWithCache(key, () => Promise.resolve(data))
    await new Promise(r => setTimeout(r, 10))
    expect(hasSnapshot(key)).toBe(true)
  })

  test('拉取抛异常时降级读快照', async () => {
    const key = `site_throws_${process.pid}`
    const data = { postCount: 7 }
    setSnapshot(key, data)

    const got = await getOrSetDataWithCache(key, () =>
      Promise.reject(new Error('Notion 宕机'))
    )
    expect(got).toEqual(data)
  })

  test('拉取返回 null 时降级读快照', async () => {
    const key = `site_null_${process.pid}`
    const data = { postCount: 9 }
    setSnapshot(key, data)

    const got = await getOrSetDataWithCache(key, () => Promise.resolve(null))
    expect(got).toEqual(data)
  })

  test('拉取返回空对象时不写缓存，且用快照兜底', async () => {
    const key = `site_empty_${process.pid}`
    const data = { postCount: 11 }
    setSnapshot(key, data)

    const got = await getOrSetDataWithCache(key, () => Promise.resolve({}))
    expect(got).toEqual(data)
  })

  test('无快照时异常继续抛出，不吞错', async () => {
    await expect(
      getOrSetDataWithCache(`site_none_${process.pid}`, () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom')
  })
})
