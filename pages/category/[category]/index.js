import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutPostList } from '@/themes/heo'

/**
 * 分类页
 * @param {*} props
 * @returns
 */
export default function Category(props) {
  return <LayoutPostList {...props} />
}

export async function getStaticProps({ params: { category }, locale }) {
  const from = 'category-props'
  let props = await fetchGlobalAllData({ from, locale })

  // 过滤状态
  props.posts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  // 处理过滤
  props.posts = props.posts.filter(
    post => post && post.category && post.category.includes(category)
  )
  // 处理文章页数
  props.postCount = props.posts.length
  // 分类页用归档时间线展示全部文章，不再按页截断：时间线没有分页入口，截断等于吞文章

  delete props.allPages

  props = { ...props, category }

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

export async function getStaticPaths() {
  const from = 'category-paths'
  const { categoryOptions } = await fetchGlobalAllData({ from })
  return {
    paths: Object.keys(categoryOptions).map(category => ({
      params: { category: categoryOptions[category]?.name }
    })),
    fallback: true
  }
}
