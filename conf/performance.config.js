const { toBoolean } = require('./env-tools')

/**
 * 鎬ц兘浼樺寲閰嶇疆
 */
module.exports = {
  // 鎳掑姞杞介厤缃?
  LAZY_LOAD_THRESHOLD: process.env.NEXT_PUBLIC_LAZY_LOAD_THRESHOLD || '200px',

  // 鍥剧墖浼樺寲
  WEBP_SUPPORT: toBoolean(process.env.NEXT_PUBLIC_WEBP_SUPPORT, true),
  AVIF_SUPPORT: toBoolean(process.env.NEXT_PUBLIC_AVIF_SUPPORT, true)
}
