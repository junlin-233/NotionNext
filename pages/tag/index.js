import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutTagIndex } from '@/themes/heo'

/**
 * 标签首页
 * @param {*} props
 * @returns
 */
const TagIndex = props => {
  return <LayoutTagIndex {...props} />
}

export async function getStaticProps(req) {
  const { locale } = req

  const from = 'tag-index-props'
  const props = await fetchGlobalAllData({ from, locale })
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

export default TagIndex
