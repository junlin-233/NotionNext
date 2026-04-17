const { toBoolean, toStringArray } = require('./env-tools')

const defaultFontUrls = [
  'https://fonts.googleapis.com/css?family=Bitter:300,400,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap'
]

const defaultSansFonts = [
  '"PingFang SC"',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  '"Segoe UI"',
  '"Noto Sans SC"',
  'HarmonyOS_Regular',
  '"Helvetica Neue"',
  'Helvetica',
  '"Source Han Sans SC"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"'
]

const defaultSerifFonts = [
  'Bitter',
  '"Noto Serif SC"',
  'SimSun',
  '"Times New Roman"',
  'Times',
  'serif',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  '"Apple Color Emoji"'
]

/**
 * 缃戠珯瀛椾綋鐩稿叧閰嶇疆
 *
 */
module.exports = {
  // START ************缃戠珯瀛椾綋*****************
  // ['font-serif','font-sans'] 涓ょ鍙€夛紝鍒嗗埆鏄‖绾垮拰鏃犺‖绾? 鍙傝€?https://www.jianshu.com/p/55e410bd2115
  // 鍚庨潰绌烘牸闅斿紑鐨刦ont-light鐨勫瓧浣撶矖缁嗭紝鐣欑┖鏄粯璁ょ矖缁嗭紱鍙傝€?https://www.tailwindcss.cn/docs/font-weight
  FONT_STYLE: process.env.NEXT_PUBLIC_FONT_STYLE || 'font-sans font-light',
  // 瀛椾綋CSS 渚嬪 https://npm.elemecdn.com/lxgw-wenkai-webfont@1.6.0/style.css
  FONT_URL: toStringArray(process.env.NEXT_PUBLIC_FONT_URL, defaultFontUrls),
  FONT_PRELOAD_URLS: toStringArray(
    process.env.NEXT_PUBLIC_FONT_PRELOAD_URLS,
    []
  ),

  // 瀛椾綋浼樺寲閰嶇疆
  FONT_DISPLAY: process.env.NEXT_PUBLIC_FONT_DISPLAY || 'swap',
  FONT_PRELOAD: toBoolean(process.env.NEXT_PUBLIC_FONT_PRELOAD, true),
  FONT_SUBSET: process.env.NEXT_PUBLIC_FONT_SUBSET || 'chinese-simplified',
  // 鏃犺‖绾垮瓧浣?渚嬪'"LXGW WenKai"'
  FONT_SANS: toStringArray(process.env.NEXT_PUBLIC_FONT_SANS, defaultSansFonts),
  // 琛嚎瀛椾綋 渚嬪'"LXGW WenKai"'
  FONT_SERIF: toStringArray(
    process.env.NEXT_PUBLIC_FONT_SERIF,
    defaultSerifFonts
  ),
  FONT_AWESOME:
    process.env.NEXT_PUBLIC_FONT_AWESOME_PATH ||
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', // font-awesome 瀛椾綋鍥炬爣鍦板潃; 鍙€?/css/all.min.css 锛?https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/font-awesome/6.0.0/css/all.min.css

  // END ************缃戠珯瀛椾綋*****************
}
