import fs from 'fs'

interface FileSystemError extends Error {
  code?: string
}

interface QueueEntry<T> {
  requestFunc: () => Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

export class RateLimiter {
  private queue: QueueEntry<unknown>[] = []
  private inflight = new Map<string, Promise<unknown>>()
  private isProcessing = false
  private lastRequestTime = 0
  private requestCount = 0
  private windowStart = Date.now()
  private lockAcquired = false
  // 等锁上限，超时后放弃持锁继续发请求（宁可少一次互斥，也不能卡死构建）
  private static readonly LOCK_WAIT_TIMEOUT = 60 * 1000
  private static readonly STALE_LOCK_AGE = 30 * 1000

  constructor(
    private maxRequestsPerMinute = 200,
    private lockFilePath?: string
  ) {
    if (this.lockFilePath && typeof process !== 'undefined') {
      process.on('exit', () => this.releaseLock())
    }
  }

  private async acquireLock(): Promise<void> {
    if (!this.lockFilePath) return
    const deadline = Date.now() + RateLimiter.LOCK_WAIT_TIMEOUT

    while (true) {
      // 陈旧锁在等待过程中也要重新判定，否则前一个进程被 kill 后会永久排队
      try {
        if (fs.existsSync(this.lockFilePath)) {
          const age = Date.now() - fs.statSync(this.lockFilePath).ctimeMs
          if (age > RateLimiter.STALE_LOCK_AGE) {
            fs.unlinkSync(this.lockFilePath)
            console.warn('[限流] 删除陈旧锁文件:', this.lockFilePath)
          }
        }
        fs.writeFileSync(this.lockFilePath, process.pid.toString(), {
          flag: 'wx'
        })
        this.lockAcquired = true
        return
      } catch (error: unknown) {
        const err = error as FileSystemError
        // 只读文件系统或删除守卫导致 unlink/write 失败时，不阻塞队列
        if (err.code !== 'EEXIST') {
          console.warn('[限流] 锁不可用，跳过互斥继续执行:', err.code || err.message)
          return
        }
      }

      if (Date.now() > deadline) {
        console.warn('[限流] 等锁超时，放弃互斥继续执行:', this.lockFilePath)
        return
      }
      await new Promise(res => setTimeout(res, 100))
    }
  }

  private releaseLock() {
    if (!this.lockFilePath || !this.lockAcquired) return
    this.lockAcquired = false
    try {
      if (fs.existsSync(this.lockFilePath)) fs.unlinkSync(this.lockFilePath)
    } catch (err) {
      console.error('释放锁失败', err)
    }
  }

  public enqueue<T>(key: string, requestFunc: () => Promise<T>): Promise<T> {
    const current = this.inflight.get(key)
    if (current) {
      return current.then(value => value as T)
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        requestFunc: requestFunc as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject
      })
      if (!this.isProcessing) void this.processQueue()
    })

    this.inflight.set(key, promise)
    void promise.then(
      () => this.inflight.delete(key),
      () => this.inflight.delete(key)
    )
    return promise
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }
    this.isProcessing = true

    try {
      await this.acquireLock()
      const now = Date.now()
      const elapsed = now - this.windowStart

      if (elapsed > 60_000) {
        this.requestCount = 0
        this.windowStart = now
      }
      if (this.requestCount >= this.maxRequestsPerMinute) {
        const waitTime = 60_000 - elapsed + 100
        await new Promise(res => setTimeout(res, waitTime))
        this.requestCount = 0
        this.windowStart = Date.now()
      }

      const minInterval = 300
      const waitTime = Math.max(0, minInterval - (now - this.lastRequestTime))
      if (waitTime > 0) await new Promise(res => setTimeout(res, waitTime))

      const { requestFunc, resolve, reject } = this.queue.shift()!
      try {
        const result = await requestFunc()
        this.lastRequestTime = Date.now()
        this.requestCount++
        resolve(result)
      } catch (error: unknown) {
        reject(error)
      }
    } catch (err) {
      console.error('限流队列异常', err)
    } finally {
      this.releaseLock()
      setTimeout(() => {
        void this.processQueue()
      }, 0)
    }
  }
}
