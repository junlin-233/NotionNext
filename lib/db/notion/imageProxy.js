/**
 * Notion 图片反代（P2.2 第一步）
 *
 * 背景：Notion 图片 URL 带 expiration_time 签名，且域名是 notion.so / S3，
 * 浏览器拿不到我们想要的缓存头。这里把图片地址改写成站内 /api/img?u=xxx，
 * 由 pages/api/img.js 回源并返回 immutable 长缓存头，让 CDN 边缘缓存生效。
 *
 * 只允许白名单主机，避免 /api/img 变成任意 URL 代理（SSRF / 开放代理）。
 * 彻底方案是 P3 同步器把图片落地到 /public/images，届时本文件自然失效。
 */

// 纯字符串变换，客户端组件也会调用，不能依赖 node 内建模块
const ALLOWED_HOSTS = [
  'notion.so',
  'notion-static.com',
  'notionusercontent.com',
  'amazonaws.com',
  'unsplash.com'
]

const PROXY_PATH = '/api/img'

function safeHostname(url) {
  try {
    const parsed = new URL(url, 'https://www.notion.so')
    return parsed.hostname
  } catch (e) {
    return null
  }
}

function isAllowedHost(hostname) {
  if (!hostname) return false
  return ALLOWED_HOSTS.some(
    host => hostname === host || hostname.endsWith(`.${host}`)
  )
}

/**
 * 判断这个地址是否需要走站内反代
 * @param {string} url
 * @param {boolean} enabled
 */
export function shouldProxyImage(url, enabled) {
  if (!enabled || !url || typeof url !== 'string') return false
  if (url.startsWith('data:') || url.startsWith('blob:')) return false
  // 已经反代 / 已经是本地化图片，不再套一层
  if (url.startsWith(PROXY_PATH) || url.startsWith('/images/')) return false
  if (!/^https?:\/\//i.test(url)) return false
  return isAllowedHost(safeHostname(url))
}

/**
 * 生成反代地址
 * @param {string} url 原始图片地址
 */
export function toProxyImageUrl(url) {
  return `${PROXY_PATH}?u=${encodeURIComponent(url)}`
}

/**
 * 反代目标校验，供 API 路由使用
 * @param {string} url
 * @returns {string|null} 合法则返回规范化后的地址
 */
export function resolveProxyTarget(url) {
  if (!url || typeof url !== 'string') return null
  let parsed
  try {
    parsed = new URL(url)
  } catch (e) {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!isAllowedHost(parsed.hostname)) return null
  return parsed.toString()
}

export { ALLOWED_HOSTS, PROXY_PATH }
