import BLOG from '@/blog.config'
import { getDataFromCache } from '@/lib/cache/cache_manager'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutSearch } from '@/themes/heo'
import { getPageContentText } from '@/lib/db/notion/getPageContentText'

const Index = props => {
  return <LayoutSearch {...props} />
}

/**
 * 服务端搜索
 * @param {*} param0
 * @returns
 */
export async function getStaticProps({ params: { keyword }, locale }) {
  const props = await fetchGlobalAllData({
    from: 'search-props',
    locale
  })
  const { allPages } = props
  const allPosts = allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  props.posts = await filterByMemCache(allPosts, keyword)
  props.postCount = props.posts.length
  const POST_LIST_STYLE = siteConfig(
    'POST_LIST_STYLE',
    'Page',
    props?.NOTION_CONFIG
  )
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)

  // 处理分页
  if (POST_LIST_STYLE === 'scroll') {
    // 滚动列表默认给前端返回所有数据
  } else if (POST_LIST_STYLE) {
    props.posts = props.posts?.slice(0, POSTS_PER_PAGE)
  }
  props.keyword = keyword
  delete props.allPages
  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : siteConfig(
          'NEXT_REVALIDATE_SECOND',
          BLOG.NEXT_REVALIDATE_SECOND,
          props.NOTION_CONFIG
        )
  }
}

export function getStaticPaths() {
  return {
    paths: [{ params: { keyword: 'NotionNext' } }],
    fallback: true
  }
}

/**
 * 在内存缓存中进行全文索引
 * @param {*} allPosts
 * @param keyword 关键词
 * @returns
 */
async function filterByMemCache(allPosts, keyword) {
  const filterPosts = []
  if (keyword) {
    keyword = keyword.trim().toLowerCase()
  }
  for (const post of allPosts) {
    const cacheKey = 'page_block_' + post.id
    const page = await getDataFromCache(cacheKey, true)
    const tagContent =
      post?.tags && Array.isArray(post?.tags) ? post?.tags.join(' ') : ''
    const categoryContent = Array.isArray(post?.category)
      ? post.category.join(' ')
      : post?.category || ''
    const articleInfo = [
      post?.title,
      post?.summary,
      tagContent,
      categoryContent
    ]
      .filter(Boolean)
      .join(' ')
    let hit = articleInfo.toLowerCase().indexOf(keyword) > -1
    const contentText = getPageContentText(post, page)
    const contentTextList = contentText ? [contentText] : []
    // console.log('全文搜索缓存', cacheKey, page != null)
    post.results = []
    let hitCount = 0
    for (const c of contentTextList) {
      if (!c) {
        continue
      }
      const index = c.toLowerCase().indexOf(keyword)
      if (index > -1) {
        hit = true
        hitCount += 1
        post.results.push(c)
      } else {
        if (
          (post.results.length - 1) / hitCount < 3 ||
          c === contentTextList[0]
        ) {
          post.results.push(c)
        }
      }
    }
    if (hit) {
      filterPosts.push(post)
    }
  }
  return filterPosts
}

export default Index
