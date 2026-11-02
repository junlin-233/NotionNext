import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * Notion 快照降级层（P2.1）
 *
 * 与 FileCache 的区别：
 * - FileCache 有 TTL，构建期使用，会过期
 * - 快照层无 TTL、显式版本号，只在真实拉取失败时读取
 *
 * 一个 key 一个文件，避免 index.json 那类单文件写竞争。
 */

const SNAPSHOT_VERSION = 1
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR
  ? path.resolve(process.env.SNAPSHOT_DIR)
  : path.resolve(process.cwd(), '.snapshot')

const enabled =
  process.env.ENABLE_SNAPSHOT === undefined
    ? true
    : !/^(false|0|off|no)$/i.test(process.env.ENABLE_SNAPSHOT)

const stats = { write: 0, hit: 0, miss: 0, error: 0 }
const staleKeys = new Set()
let lastStaleAt = null

function fileOf(key) {
  const hash = crypto.createHash('md5').update(key).digest('hex')
  return path.join(SNAPSHOT_DIR, `${hash}.json`)
}

function ensureDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  }
}

/**
 * 写入快照。失败只告警，不影响主流程（只读文件系统环境下静默降级）
 */
export function setSnapshot(key, data) {
  if (!enabled || !data) return false

  try {
    ensureDir()
    const payload = {
      v: SNAPSHOT_VERSION,
      key,
      savedAt: new Date().toISOString(),
      data
    }
    const target = fileOf(key)
    const tmp = `${target}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(payload))
    fs.renameSync(tmp, target)
    stats.write++
    return true
  } catch (e) {
    stats.error++
    console.warn(`[Snapshot] 写入失败 key:${key} ${e.message}`)
    return false
  }
}

/**
 * 读取快照，返回 { data, savedAt } 或 null
 */
export function getSnapshot(key) {
  if (!enabled) return null

  try {
    const file = fileOf(key)
    if (!fs.existsSync(file)) {
      stats.miss++
      return null
    }
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!payload || payload.v !== SNAPSHOT_VERSION || !payload.data) {
      stats.miss++
      return null
    }
    stats.hit++
    staleKeys.add(key)
    lastStaleAt = new Date().toISOString()
    return { data: payload.data, savedAt: payload.savedAt }
  } catch (e) {
    stats.error++
    console.warn(`[Snapshot] 读取失败 key:${key} ${e.message}`)
    return null
  }
}

export function hasSnapshot(key) {
  return enabled && fs.existsSync(fileOf(key))
}

/**
 * 供 /api/status 输出，判断站点当前是否处于降级状态
 */
export function getSnapshotStats() {
  let files = 0
  try {
    if (fs.existsSync(SNAPSHOT_DIR)) {
      files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json')).length
    }
  } catch (e) {
    // 目录不可读时忽略，files 保持 0
  }

  return {
    enabled,
    dir: SNAPSHOT_DIR,
    files,
    ...stats,
    staleCount: staleKeys.size,
    lastStaleAt
  }
}

function printSummary() {
  if (stats.write === 0 && stats.hit === 0) return
  console.log(
    `[Snapshot] write:${stats.write} fallback-hit:${stats.hit} miss:${stats.miss} error:${stats.error}`
  )
}

if (typeof process !== 'undefined') {
  process.on('exit', printSummary)
}

const snapshotStore = { setSnapshot, getSnapshot, hasSnapshot, getSnapshotStats }

export default snapshotStore
