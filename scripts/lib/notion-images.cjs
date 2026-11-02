/**
 * Notion 图片本地化
 *
 * 先把 recordMap 里所有图片地址收集出来（纯函数，不改数据），
 * 统一下载后再回填成本地路径。这样下载失败不会留下半改的 JSON。
 *
 * 幂等关键：Notion 的 S3 签名参数每次都变（X-Amz-Signature / Expires），
 * 文件名必须基于「去掉签名后的地址」做 hash，否则每天同步都会新增一堆文件。
 */

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i
const NOTION_IMAGE_HOSTS = [
  'notion.so',
  'notion-static.com',
  'notionusercontent.com',
  'amazonaws.com',
  'unsplash.com',
  'githubusercontent.com'
]

const SIGNATURE_PARAMS = [
  'x-amz-algorithm',
  'x-amz-credential',
  'x-amz-date',
  'x-amz-expires',
  'x-amz-security-token',
  'x-amz-signature',
  'x-amz-signedheaders',
  'expiration_time',
  'signature',
  'policy',
  'key-pair-id',
  'expires',
  'token',
  't'
]

function isSignatureParam(key) {
  return SIGNATURE_PARAMS.includes(key.toLowerCase())
}

function stripSignature(search) {
  const params = new URLSearchParams(search || '')
  const kept = new URLSearchParams()
  for (const [key, value] of params) {
    if (isSignatureParam(key)) continue
    kept.set(key, value)
  }
  return kept.toString()
}

/**
 * 归一化图片地址，作为去重与文件名的依据
 */
function normalizeImageKey(url) {
  if (typeof url !== 'string') return null

  if (url.startsWith('attachment:')) {
    // attachment:<id>:<filename>；文件名可能变，只保留 id
    const parts = url.split(':')
    return `attachment:${parts[1] || ''}`
  }

  try {
    const parsed = new URL(url)
    // notion.so/image/<encodeURIComponent(源地址)>?table=block&id=xxx
    if (/^\/(image|signed)\//.test(parsed.pathname)) {
      const encoded = parsed.pathname.replace(/^\/(image|signed)\//, '')
      let inner = ''
      try {
        inner = decodeURIComponent(encoded)
      } catch (e) {
        inner = encoded
      }
      const innerKey = normalizeImageKey(inner) || inner
      return `${parsed.hostname}${parsed.pathname.split('/')[1]}:${innerKey}`
    }
    const query = stripSignature(parsed.search.slice(1))
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`
  } catch (e) {
    return url
  }
}

/**
 * 判断字符串值是否是图片资源
 */
const SKIP_HOSTS = ['source.unsplash.com', 'picsum.photos', 'placeholder.com']

function looksLikeImage(value) {
  if (typeof value !== 'string') return false
  if (SKIP_HOSTS.some(host => value.includes(host))) return false
  if (value.startsWith('attachment:')) return true
  if (!/^https?:\/\//i.test(value)) return false
  if (IMAGE_EXT_RE.test(value)) return true
  try {
    const host = new URL(value).hostname
    return NOTION_IMAGE_HOSTS.some(
      h => host === h || host.endsWith(`.${h}`)
    )
  } catch (e) {
    return false
  }
}

function walkStrings(node, visit, blockId = null) {
  if (Array.isArray(node)) {
    node.forEach(item => walkStrings(item, visit, blockId))
    return
  }
  if (node && typeof node === 'object') {
    const id = typeof node.id === 'string' ? node.id : blockId
    for (const key of Object.keys(node)) {
      walkStrings(node[key], visit, id)
    }
    return
  }
  if (typeof node === 'string') visit(node, blockId)
}

/**
 * 收集 recordMap 中的所有图片地址
 * @returns {Map<string, {raw: string, blockId: string|null}>} key → 原始信息
 */
function collectImageSources(recordMap) {
  const found = new Map()
  walkStrings(recordMap, (value, blockId) => {
    if (!looksLikeImage(value)) return
    const key = normalizeImageKey(value)
    if (!key || found.has(key)) return
    found.set(key, { raw: value, blockId })
  })
  return found
}

/**
 * 深拷贝后把图片地址换成本地路径
 */
function applyImageMap(recordMap, keyToPath) {
  const clone = JSON.parse(JSON.stringify(recordMap))
  const replace = node => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = replace(node[i])
      return node
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) node[key] = replace(node[key])
      return node
    }
    if (typeof node === 'string' && looksLikeImage(node)) {
      const key = normalizeImageKey(node)
      return keyToPath.get(key) || node
    }
    return node
  }
  return replace(clone)
}

/**
 * 图片真正的下载地址
 *
 * 三种情况：
 * - attachment: 协议 → /signed/ 换签名链接
 * - S3 / notion-static 直链 → 裸地址没有签名，直连必 403，要走 /image/ 让 Notion 现签
 * - 已经是 notion.so/image 或第三方图床 → 原样
 */
function resolveDownloadUrl(raw, blockId, spaceId) {
  if (!raw.startsWith('attachment:')) {
    // Notion 的 /image/ 端点处理不了 svg，直连也没签名，跳过本地化
    if (/\.svg(\?|$)/i.test(raw)) return ''
    // 已经带签名的直链可以直接下载；只有裸链才要 Notion 现签
    const hasSignature = /[?&](x-amz-signature|signature|expiration_time)=/i.test(raw)
    const needsSigning =
      !hasSignature &&
      /prod-files-secure|secure\.notion-static\.com|s3[.-][a-z0-9-]+\.amazonaws\.com/i.test(
        raw
      ) &&
      !/notion\.so\/(image|signed)\//i.test(raw)
    if (!needsSigning) return raw
    const query = new URLSearchParams({ table: 'block' })
    if (blockId) query.set('id', blockId)
    return `https://www.notion.so/image/${encodeURIComponent(raw)}?${query}`
  }
  const query = new URLSearchParams({ table: 'block' })
  if (blockId) query.set('id', blockId)
  if (spaceId) query.set('spaceId', spaceId)
  return `https://www.notion.so/signed/${encodeURIComponent(raw)}?${query}`
}

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico'
}

function guessExt(raw, contentType) {
  const byType = EXT_BY_TYPE[(contentType || '').split(';')[0].trim()]
  if (byType) return byType
  const match = raw.split('?')[0].match(IMAGE_EXT_RE)
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

module.exports = {
  normalizeImageKey,
  looksLikeImage,
  collectImageSources,
  applyImageMap,
  resolveDownloadUrl,
  guessExt
}
