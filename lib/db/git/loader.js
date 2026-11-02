/**
 * Git 内容源的读取层（P3）
 *
 * 只做一件事：把 content/ 下的 JSON 读成和 Notion API 一样的 recordMap 结构，
 * 上层 convertNotionToSiteData 完全不用改，两种数据源产出天然一致。
 *
 * 为什么存原始 recordMap：
 * normalize/adapter/getPageProperties 那一整套转换在 lib/db/notion 里，
 * 带着 TS 和 @/ 别名，脚本侧无法直接复用。存原始数据、运行时用同一套转换，
 * 比在脚本里抄一份转换逻辑安全得多。
 */

import fs from 'fs'
import path from 'path'
import BLOG from '@/blog.config'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const INDEX_FILE = path.join(CONTENT_DIR, 'index.json')

let indexCache = null
let indexMtime = 0

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    return null
  }
}

export function isGitSource() {
  return BLOG.CONTENT_SOURCE === 'git'
}

export function getContentIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null
  const stat = fs.statSync(INDEX_FILE)
  if (indexCache && stat.mtimeMs === indexMtime) return indexCache
  indexCache = readJson(INDEX_FILE)
  indexMtime = stat.mtimeMs
  return indexCache
}

/**
 * react-notion-x 的 Asset 组件在 block.space_id 存在时会 new URL(source)，
 * 本地化图片是相对路径（/images/notion/xxx），直接抛 Invalid URL。
 * 本地图片不需要 spaceId 签名，读的时候摘掉。
 */
function stripSpaceIdForLocalImages(recordMap) {
  if (!recordMap?.block) return recordMap
  for (const entry of Object.values(recordMap.block)) {
    const value = entry?.value?.value || entry?.value
    if (!value) continue
    const source = value.properties?.source?.[0]?.[0]
    const display = value.format?.display_source
    const local =
      (typeof source === 'string' && source.startsWith('/')) ||
      (typeof display === 'string' && display.startsWith('/'))
    if (local) delete value.space_id
  }
  return recordMap
}

function stripLocalePrefix(id) {
  return id && id.includes(':') ? id.split(':').slice(-1)[0] : id
}

/**
 * 读站点数据库页的 recordMap，并把每篇文章的行 block 合并进去。
 * 不合并的话 convertNotionToSiteData 会认为这些行缺 block，运行时再去联网补拉。
 */
export function readSiteRecordMap(siteId) {
  const index = getContentIndex()
  if (!index) return null

  const id = stripLocalePrefix(siteId)
  const siteFile = path.join(CONTENT_DIR, 'sites', `${id}.json`)
  const recordMap = readJson(siteFile)
  if (!recordMap) return null

  recordMap.block = recordMap.block || {}

  for (const entry of index.pages || []) {
    const pageFile = path.join(CONTENT_DIR, 'pages', `${entry.file}.json`)
    const pageMap = readJson(pageFile)
    const rowBlock = pageMap?.block?.[entry.id]
    if (rowBlock) recordMap.block[entry.id] = rowBlock
  }

  return stripSpaceIdForLocalImages(recordMap)
}

/**
 * 读单篇的 recordMap（文章正文）
 */
export function readPageRecordMap(pageId) {
  const index = getContentIndex()
  if (!index) return null

  const entry = (index.pages || []).find(item => item.id === pageId)
  if (!entry) return null

  return stripSpaceIdForLocalImages(
    readJson(path.join(CONTENT_DIR, 'pages', `${entry.file}.json`))
  )
}

/**
 * 按 slug / id 找文章文件，用于 URL 里直接带 id 的情况
 */
export function findContentEntry(identifier) {
  const index = getContentIndex()
  if (!index) return null
  const pages = index.pages || []
  return (
    pages.find(item => item.id === identifier) ||
    pages.find(item => item.file === identifier) ||
    null
  )
}

export function getContentStats() {
  const index = getContentIndex()
  if (!index) return { available: false, pages: 0 }
  return {
    available: true,
    pages: index.pages?.length || 0,
    sites: index.sites?.length || 0,
    generatedAt: index.generatedAt || null
  }
}
