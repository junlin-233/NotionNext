import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { Layout404 } from '@/themes/heo'

/**
 * 404
 * @param {*} props
 * @returns
 */
const NoFound = props => {
  return <Layout404 {...props} />
}

export async function getStaticProps(req) {
  const { locale } = req

  const props = (await fetchGlobalAllData({ from: '404', locale })) || {}
  return { props }
}

export default NoFound
