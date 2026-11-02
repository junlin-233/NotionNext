/**
 * Git 内容源入口（P3.3）
 *
 * 与 `SiteDataApi` 完全同签名：fetchGlobalAllData / resolvePostProps / getPostBlocks。
 *
 * 分派位置说明：真正的开关在 `SiteDataApi` 内部（读 BLOG.CONTENT_SOURCE），
 * 这样 24 个页面调用点一行都不用改，切源只改环境变量。
 * 这里保留同名导出，给需要显式表达「我在读 git 内容」的新代码用。
 */

export {
  fetchGlobalAllData,
  getSiteDataByPageId,
  resolvePostProps,
  getPostBlocks,
  getPost,
  getAllTags
} from './SiteDataApi'
export { getContentStats, getContentIndex } from './loader'
