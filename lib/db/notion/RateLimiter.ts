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

  constructor(
    private maxRequestsPerMinute = 200,
    private lockFilePath?: string
  ) {}

  private async acquireLock(): Promise<void> {
    if (!this.lockFilePath) return
    // 如果锁文件存在且创建时间过久（比如 >5分钟），认为是陈旧锁，直接删除
    if (fs.existsSync(this.lockFilePath)) {
      const stats = fs.statSync(this.lockFilePath)
      const age = Date.now() - stats.ctimeMs
      if (age > 30 * 1000) {
        // 30秒
        try {
          fs.unlinkSync(this.lockFilePath)
          console.warn('[限流] 删除陈旧锁文件:', this.lockFilePath)
        } catch (err) {
          console.error('[限流] 删除陈旧锁失败:', err)
        }
      }
    }
    while (true) {
      try {
        fs.writeFileSync(this.lockFilePath, process.pid.toString(), {
          flag: 'wx'
        })
        return
      } catch (error: unknown) {
        const err = error as FileSystemError
        if (err.code === 'EEXIST')
          await new Promise(res => setTimeout(res, 100))
        else throw err
      }
    }
  }

  private releaseLock() {
    if (!this.lockFilePath) return
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
