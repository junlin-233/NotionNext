const { toBoolean } = require('./env-tools')

/**
 * 网页右键点击后是否弹出自定义菜单
 */
module.exports = {
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU,
    true
  ), // 自定义右键菜单，覆盖系统菜单
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU_DARK_MODE: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU_DARK_MODE,
    true
  ), // 是否显示深色模式
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU_SHARE_LINK: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU_SHARE_LINK,
    true
  ), // 是否显示分享链接
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU_RANDOM_POST: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU_RANDOM_POST,
    true
  ), // 是否显示随机博客
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU_CATEGORY: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU_CATEGORY,
    true
  ), // 是否显示分类
  CUSTOM_RIGHT_CLICK_CONTEXT_MENU_TAG: toBoolean(
    process.env.NEXT_PUBLIC_CUSTOM_RIGHT_CLICK_CONTEXT_MENU_TAG,
    true
  ) // 是否显示标签
}
