import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { LayoutCategoryIndex } from '@/themes/heo'

/**
 * 分类首页
 * @param {*} props
 * @returns
 */
export default function Category(props) {
  return <LayoutCategoryIndex {...props} />
}

export async function getStaticProps({ locale }) {
  const props = await fetchGlobalAllData({
    from: 'category-index-props',
    locale
  })
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
