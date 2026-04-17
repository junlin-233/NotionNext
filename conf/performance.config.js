const { toBoolean, toNumber } = require('./env-tools')

/**
 * 鎬ц兘浼樺寲閰嶇疆
 */
module.exports = {
  // 棰勫姞杞介厤缃?
  PRELOAD_CRITICAL_RESOURCES: toBoolean(
    process.env.NEXT_PUBLIC_PRELOAD_CRITICAL_RESOURCES,
    true
  ),

  // 鎳掑姞杞介厤缃?
  LAZY_LOAD_IMAGES: toBoolean(process.env.NEXT_PUBLIC_LAZY_LOAD_IMAGES, true),
  LAZY_LOAD_THRESHOLD: process.env.NEXT_PUBLIC_LAZY_LOAD_THRESHOLD || '200px',

  // 浠ｇ爜鍒嗗壊閰嶇疆
  ENABLE_CODE_SPLITTING: toBoolean(
    process.env.NEXT_PUBLIC_ENABLE_CODE_SPLITTING,
    true
  ),
  CHUNK_SIZE_LIMIT: toNumber(process.env.NEXT_PUBLIC_CHUNK_SIZE_LIMIT, 244000), // 244KB

  // 缂撳瓨閰嶇疆
  BROWSER_CACHE_TTL: toNumber(process.env.NEXT_PUBLIC_BROWSER_CACHE_TTL, 86400), // 24灏忔椂
  CDN_CACHE_TTL: toNumber(process.env.NEXT_PUBLIC_CDN_CACHE_TTL, 604800), // 7澶?

  // 鍘嬬缉閰嶇疆
  ENABLE_GZIP: toBoolean(process.env.NEXT_PUBLIC_ENABLE_GZIP, true),
  ENABLE_BROTLI: toBoolean(process.env.NEXT_PUBLIC_ENABLE_BROTLI, true),

  // 瀛椾綋浼樺寲
  FONT_DISPLAY: process.env.NEXT_PUBLIC_FONT_DISPLAY || 'swap',
  PRELOAD_FONTS: toBoolean(process.env.NEXT_PUBLIC_PRELOAD_FONTS, true),

  // 绗笁鏂硅剼鏈紭鍖?
  DEFER_THIRD_PARTY_SCRIPTS: toBoolean(
    process.env.NEXT_PUBLIC_DEFER_THIRD_PARTY_SCRIPTS,
    true
  ),

  // 鍥剧墖浼樺寲
  WEBP_SUPPORT: toBoolean(process.env.NEXT_PUBLIC_WEBP_SUPPORT, true),
  AVIF_SUPPORT: toBoolean(process.env.NEXT_PUBLIC_AVIF_SUPPORT, true),

  // 棰勫彇閰嶇疆
  PREFETCH_LINKS: toBoolean(process.env.NEXT_PUBLIC_PREFETCH_LINKS, true),
  PREFETCH_IMAGES: toBoolean(process.env.NEXT_PUBLIC_PREFETCH_IMAGES, false),

  // 鎬ц兘鐩戞帶
  ENABLE_WEB_VITALS: toBoolean(process.env.NEXT_PUBLIC_ENABLE_WEB_VITALS, true),
  PERFORMANCE_BUDGET: {
    FCP: 1800, // First Contentful Paint (ms)
    LCP: 2500, // Largest Contentful Paint (ms)
    FID: 100, // First Input Delay (ms)
    CLS: 0.1 // Cumulative Layout Shift
  }
}
