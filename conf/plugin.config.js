const { toNumber } = require('./env-tools')

/**
 * 一些插件
 */
module.exports = {
  // 全文搜索已切换为 Pagefind 本地索引（构建后由 scripts/build-search-index.js 生成 public/pagefind/）

  // AI 文章摘要生成
  AI_SUMMARY_API: process.env.AI_SUMMARY_API || '',
  AI_SUMMARY_KEY: process.env.AI_SUMMARY_KEY || '',
  AI_SUMMARY_CACHE_TIME: toNumber(process.env.AI_SUMMARY_CACHE_TIME, 1800), // 缓存时间，单位秒
  AI_SUMMARY_WORD_LIMIT: toNumber(process.env.AI_SUMMARY_WORD_LIMIT, 1000),

  // 邮件
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID || null, // 开启 mailchimp 邮件订阅 列表ID
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY || null // 开启 mailchimp 邮件订阅 APIkey
}
