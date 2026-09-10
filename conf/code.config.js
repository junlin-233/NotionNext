const { toBoolean } = require('./env-tools')

/**
 * 网页中代码显示的效果
 */
module.exports = {
  // START********代码相关********
  // PrismJs 代码相关
  PRISM_JS_PATH: 'https://npm.elemecdn.com/prismjs@1.29.0/components/',
  PRISM_JS_AUTO_LOADER:
    'https://npm.elemecdn.com/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js',

  // 代码主题 @see https://github.com/PrismJS/prism-themes
  PRISM_THEME_PREFIX_PATH:
    process.env.NEXT_PUBLIC_PRISM_THEME_PREFIX_PATH ||
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-okaidia.css', // 代码块默认主题
  PRISM_THEME_SWITCH: toBoolean(
    process.env.NEXT_PUBLIC_PRISM_THEME_SWITCH,
    true
  ), // 是否开启浅色/深色模式代码主题切换
  PRISM_THEME_LIGHT_PATH:
    process.env.NEXT_PUBLIC_PRISM_THEME_LIGHT_PATH ||
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-solarizedlight.css', // 浅色模式主题
  PRISM_THEME_DARK_PATH:
    process.env.NEXT_PUBLIC_PRISM_THEME_DARK_PATH ||
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-okaidia.min.css', // 深色模式主题

  CODE_MAC_BAR: toBoolean(process.env.NEXT_PUBLIC_CODE_MAC_BAR, true), // 代码左上角显示mac的红黄绿图标
  CODE_LINE_NUMBERS: toBoolean(
    process.env.NEXT_PUBLIC_CODE_LINE_NUMBERS,
    false
  ), // 是否显示行号
  CODE_COLLAPSE: toBoolean(process.env.NEXT_PUBLIC_CODE_COLLAPSE, true), // 是否支持折叠代码框
  CODE_COLLAPSE_EXPAND_DEFAULT: toBoolean(
    process.env.NEXT_PUBLIC_CODE_COLLAPSE_EXPAND_DEFAULT,
    true
  ), // 折叠代码默认是展开状态
  // Mermaid 图表CDN
  MERMAID_CDN:
    process.env.NEXT_PUBLIC_MERMAID_CDN ||
    'https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.min.js' // CDN

  // END********代码相关********
}
