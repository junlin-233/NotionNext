import { formatDateFmt } from '@/lib/utils/formatDate'

/**
 * 把文章按「年-月」分组，用归档页那套时间线来渲染。
 * 归档页、分类页、标签页共用，保证点分类标签时样式不会突变。
 * @param {Array} posts 文章列表
 * @returns {Object} { '2026-06': [post, ...], ... }，分组本身按时间倒序
 */
export function groupPostsByMonth(posts = []) {
  const sorted = [...posts].sort(
    (a, b) => (b?.publishDate || 0) - (a?.publishDate || 0)
  )

  const groups = {}
  sorted.forEach(post => {
    const key = formatDateFmt(post?.publishDate, 'yyyy-MM') || '未分组'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(post)
  })
  return groups
}
