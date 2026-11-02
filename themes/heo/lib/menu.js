import { siteConfig } from '@/lib/config'
import CONFIG from '../config'

/**
 * 按主题配置改写从 Notion 读到的菜单。
 * 目前支持覆盖跳转地址、清空下拉子项，用于「往期整理」这类把下拉收成单跳转的场景。
 * @param {Array} links 菜单数组
 * @returns {Array} 改写后的菜单数组
 */
export function applyMenuOverride(links) {
  const menuOverride = siteConfig('HEO_MENU_OVERRIDE', {}, CONFIG)
  if (!links?.length || !menuOverride) {
    return links
  }

  return links.map(link => {
    if (!link) return link
    const patch = menuOverride[link.name] || menuOverride[link.title]
    if (!patch) return link
    return { ...link, ...patch, subMenus: patch.subMenus || [] }
  })
}
