const { toBoolean, toNumber } = require('./env-tools')

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

  // 站内 AI 问答（RAG）的前端开关。
  // 只用公开变量控制显隐；API Key 只在 pages/api/ai-chat.js 里从 process.env 读，
  // 不写进 blog.config，否则会被打进浏览器 bundle。
  AI_CHAT_ENABLE: toBoolean(process.env.NEXT_PUBLIC_AI_CHAT_ENABLE, false),
  AI_CHAT_TITLE: process.env.NEXT_PUBLIC_AI_CHAT_TITLE || '问问我写过什么',

  // 邮件
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID || null, // 开启 mailchimp 邮件订阅 列表ID
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY || null // 开启 mailchimp 邮件订阅 APIkey
}
