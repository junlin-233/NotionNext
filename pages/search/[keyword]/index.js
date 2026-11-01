import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutSearch } from '@/themes/heo'

const Index = props => {
  return <LayoutSearch {...props} />
}

/**
 * 搜索结果页
 * 搜索由客户端 Pagefind 索引完成（public/pagefind/），
 * 服务端只提供布局数据，不再预渲染全站文章。
 */
export async function getStaticProps({ params: { keyword }, locale }) {
  const props = await fetchGlobalAllData({
    from: 'search-props',
    locale
  })
  delete props.allPages
  props.posts = []
  props.keyword = keyword
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

export default Index
