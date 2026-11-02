import { getSnapshotStats } from '@/lib/cache/snapshot_store'

/**
 * 站点降级状态接口
 * GET /api/status
 *
 * 用于判断线上当前是否在吃快照（Notion 拉取失败），
 * 也可挂到外部拨测上做告警依据。
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).end()
    return
  }

  res.setHeader('Cache-Control', 'no-store')

  const snapshot = getSnapshotStats()
  res.status(200).json({
    degraded: snapshot.hit > 0,
    snapshot
  })
}
