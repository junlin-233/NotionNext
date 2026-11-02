import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutHot } from '@/themes/heo'
import CONFIG from '@/themes/heo/config'

/**
 * 热门文章：按站内阅读量排序
 * 阅读统计没启用（没配 REDIS_URL）时退回最近更新，不显示阅读数
 */
const Hot = props => {
  return <LayoutHot {...props} />
}

export async function getStaticProps({ locale }) {
  // 计数器依赖 Redis / fs，只在服务端用，动态引入避免打进前端包
  const { getTopViews, isViewsEnabled } = await import('@/lib/views')
  const props = await fetchGlobalAllData({ from: 'hot', locale })
  const posts = (props.allPages || []).filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  delete props.allPages

  const enabled = isViewsEnabled()
  const limit = siteConfig('HEO_HOT_POST_COUNT', 20, CONFIG)

  let hotPosts = []
  if (enabled) {
    const ranked = await getTopViews(limit * 5)
    const viewMap = new Map(ranked.map(item => [item.slug, item.count]))
    hotPosts = posts
      .map(post => ({ ...post, views: viewMap.get(post.slug) || 0 }))
      .filter(post => post.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, limit)
  }

  // 还没有阅读数据（刚上线 / Redis 没配）时，退回最近更新
  if (hotPosts.length === 0) {
    hotPosts = [...posts]
      .sort((a, b) => (b?.publishDate || 0) - (a?.publishDate || 0))
      .slice(0, limit)
  }

  props.hotPosts = hotPosts
  props.viewsEnabled = enabled && hotPosts.some(post => post.views > 0)

  return {
    props,
    // EXPORT 模式（静态导出）不允许 revalidate
    revalidate: process.env.EXPORT ? undefined : 300
  }
}

export default Hot
