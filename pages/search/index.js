import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutSearch } from '@/themes/heo'
import { useRouter } from 'next/router'

/**
 * 搜索路由
 * @param {*} props
 * @returns
 */
const Search = props => {
  const { posts } = props

  const router = useRouter()
  const rawKeyword = router?.query?.s
  const keyword = Array.isArray(rawKeyword) ? rawKeyword[0] : rawKeyword

  let filteredPosts
  // 静态过滤
  if (keyword) {
    filteredPosts = posts.filter(post => {
      const tagContent = post?.tags ? post?.tags.join(' ') : ''
      const categoryContent = Array.isArray(post?.category)
        ? post.category.join(' ')
        : post?.category || ''
      const searchContent = [
        post?.title,
        post?.summary,
        tagContent,
        categoryContent
      ]
        .filter(Boolean)
        .join(' ')
      return searchContent.toLowerCase().includes(keyword.toLowerCase())
    })
  } else {
    filteredPosts = []
  }

  props = { ...props, posts: filteredPosts }
  return <LayoutSearch {...props} />
}

/**
 * 浏览器前端搜索
 */
export async function getStaticProps({ locale }) {
  const props = await fetchGlobalAllData({
    from: 'search-props',
    locale
  })
  const { allPages } = props
  props.posts = allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
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

export default Search
