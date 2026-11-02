import BLOG from '@/blog.config'
import { getSnapshotStats } from '@/lib/cache/snapshot_store'
import { getContentStats } from '@/lib/db/git/loader'
import { isKnowledgeReady } from '@/lib/ai/knowledge'

/**
 * 站点降级状态接口
 * GET /api/status
 *
 * 用于判断线上当前是否在吃快照（Notion 拉取失败），
 * 也可挂到外部拨测上做告警依据。
 *
 * P3 后新增 content / knowledge：
 * - content：git 内容源是否就绪、同步了多少篇
 * - knowledge：RAG 向量文件是否存在
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
    contentSource: BLOG.CONTENT_SOURCE || 'notion',
    content: getContentStats(),
    knowledge: { ready: isKnowledgeReady() },
    snapshot
  })
}
