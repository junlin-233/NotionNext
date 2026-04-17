import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData, getPostBlocks } from '@/lib/db/SiteDataApi'
import { checkDataFromAlgolia } from '@/lib/plugins/algolia'
import { generateRedirectJson } from '@/lib/utils/redirect'
import { generateRobotsTxt } from '@/lib/utils/robots.txt'
import { generateRss } from '@/lib/utils/rss'
import { generateSitemapXml } from '@/lib/utils/sitemap.xml'
import { DynamicLayout } from '@/themes/theme'

const shouldGenerateStaticArtifacts =
  process.env.npm_lifecycle_event === 'build' ||
  process.env.npm_lifecycle_event === 'export' ||
  BLOG.ENABLE_RUNTIME_GENERATED_FILES

/**
 * 棣栭〉甯冨眬
 * @param {*} props
 * @returns
 */
const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutIndex' {...props} />
}

async function generateStaticArtifacts(props) {
  generateRobotsTxt(props)
  generateSitemapXml(props)

  if (siteConfig('ENABLE_RSS', BLOG.ENABLE_RSS, props?.NOTION_CONFIG)) {
    await generateRss(props)
  }

  if (siteConfig('UUID_REDIRECT', false, props?.NOTION_CONFIG)) {
    generateRedirectJson(props)
  }
}

/**
 * SSG 鑾峰彇鏁版嵁
 * @returns
 */
export async function getStaticProps(req) {
  const { locale } = req
  const from = 'index'
  const props = await fetchGlobalAllData({ from, locale })
  const POST_PREVIEW_LINES = siteConfig(
    'POST_PREVIEW_LINES',
    12,
    props?.NOTION_CONFIG
  )
  props.posts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )

  // 澶勭悊鍒嗛〉
  if (siteConfig('POST_LIST_STYLE') === 'scroll') {
    // 婊氬姩鍒楄〃榛樿缁欏墠绔繑鍥炴墍鏈夋暟鎹?
  } else if (siteConfig('POST_LIST_STYLE') === 'page') {
    props.posts = props.posts?.slice(
      0,
      siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
    )
  }

  // 棰勮鏂囩珷鍐呭
  if (siteConfig('POST_LIST_PREVIEW', false, props?.NOTION_CONFIG)) {
    for (const i in props.posts) {
      const post = props.posts[i]
      if (post.password && post.password !== '') {
        continue
      }
      post.blockMap = await getPostBlocks(post.id, 'slug', POST_PREVIEW_LINES)
    }
  }

  if (shouldGenerateStaticArtifacts) {
    await generateStaticArtifacts(props)
  }

  // 妫€鏌ユ暟鎹槸鍚﹂渶瑕佷粠algolia鍒犻櫎
  await checkDataFromAlgolia(props)

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

export default Index
