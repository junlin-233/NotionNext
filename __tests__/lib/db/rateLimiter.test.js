/**
 * 限流锁测试（P2 前提项）
 * 重点验证：陈旧锁能被清理、拿不到锁时不会卡死队列
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const { RateLimiter } = require('@/lib/db/notion/RateLimiter')

function freshLockPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratelimit-'))
  return path.join(dir, '.notion-api-lock.123')
}

describe('RateLimiter 锁', () => {
  test('正常执行后释放锁文件', async () => {
    const lockPath = freshLockPath()
    const limiter = new RateLimiter(200, lockPath)

    const result = await limiter.enqueue('k1', () => Promise.resolve('done'))

    expect(result).toBe('done')
    expect(fs.existsSync(lockPath)).toBe(false)
  })

  test('陈旧锁会被清理并继续执行', async () => {
    const lockPath = freshLockPath()
    fs.writeFileSync(lockPath, '99999')

    // 伪造 2 分钟前的锁，避免依赖真实时间
    const realStat = fs.statSync
    jest.spyOn(fs, 'statSync').mockImplementation((p, o) => {
      const stat = realStat(p, o)
      if (p === lockPath) stat.ctimeMs = Date.now() - 120 * 1000
      return stat
    })

    const limiter = new RateLimiter(200, lockPath)
    const result = await limiter.enqueue('k2', () => Promise.resolve('ok'))

    expect(result).toBe('ok')
    expect(fs.existsSync(lockPath)).toBe(false)
  })

  test('锁不可写时不阻塞队列', async () => {
    const lockPath = freshLockPath()
    const eio = Object.assign(new Error('disk gone'), { code: 'EIO' })
    jest.spyOn(fs, 'writeFileSync').mockImplementation((p, ...rest) => {
      if (p === lockPath) throw eio
      return undefined
    })

    const limiter = new RateLimiter(200, lockPath)
    const result = await limiter.enqueue('k3', () => Promise.resolve('passed'))

    expect(result).toBe('passed')
  })

  test('请求失败时错误透传，队列继续处理下一个', async () => {
    const lockPath = freshLockPath()
    const limiter = new RateLimiter(200, lockPath)

    await expect(
      limiter.enqueue('bad', () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom')

    await expect(
      limiter.enqueue('good', () => Promise.resolve('next'))
    ).resolves.toBe('next')
  })
})
