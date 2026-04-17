const { toBoolean } = require('./env-tools')

/**
 * 寮€鍙戜汉鍛樺彲鑳介渶瑕佸叧娉ㄧ殑閰嶇疆
 */
module.exports = {
  SUB_PATH: '', // leave this empty unless you want to deploy in a folder
  DEBUG: toBoolean(process.env.NEXT_PUBLIC_DEBUG, false), // 鏄惁鏄剧ず璋冭瘯鎸夐挳
  // TAILWINDCSS 閰嶇疆鐨勮嚜瀹氫箟棰滆壊锛屼綔搴?
  BACKGROUND_LIGHT: '#eeeeee', // use hex value, don't forget '#' e.g #fffefc
  BACKGROUND_DARK: '#000000', // use hex value, don't forget '#'

  // Redis 缂撳瓨鏁版嵁搴撳湴鍧€
  REDIS_URL: process.env.REDIS_URL || '',

  ENABLE_CACHE:
    process.env.ENABLE_CACHE === undefined
      ? process.env.npm_lifecycle_event === 'build' ||
        process.env.npm_lifecycle_event === 'export'
      : toBoolean(process.env.ENABLE_CACHE, false), // 鍦ㄦ墦鍖呰繃绋嬩腑榛樿寮€鍚紦瀛橈紝寮€鍙戞垨杩愯鏃跺紑鍚鍔熻兘鎰忎箟涓嶅ぇ銆?
  isProd: process.env.VERCEL_ENV === 'production' || process.env.EXPORT, // distinguish between development and production environment (ref: https://vercel.com/docs/environment-variables#system-environment-variables)
  BUNDLE_ANALYZER: process.env.ANALYZE === 'true' || false, // 鏄惁灞曠ず缂栬瘧渚濊禆鍐呭涓庡ぇ灏?
  VERSION: (() => {
    try {
      // 浼樺厛浣跨敤鐜鍙橀噺锛屽惁鍒欎粠package.json涓幏鍙栫増鏈彿
      return (
        process.env.NEXT_PUBLIC_VERSION || require('../package.json').version
      )
    } catch (error) {
      console.warn('Failed to load package.json version:', error)
      return '1.0.0' // 缂虹渷鐗堟湰鍙?
    }
  })()
}
