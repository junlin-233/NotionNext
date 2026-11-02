/**
 * Notion recordMap → Markdown
 *
 * 用途：同步器把 Notion 正文落成 markdown，供 Pagefind 建索引、RAG 切段、
 * 以及 git diff 时人眼可读。站点渲染仍然走 blockMap JSON，不依赖这个文件。
 *
 * 纯 CJS、零依赖，可以被 scripts/ 下的 node 脚本直接 require。
 */

const INDENT = '  '

/**
 * 兼容三种 block 结构：
 * 新格式 { spaceId, value: { value: {...}, role } } / 次格式 { value: {...}, role } / 旧格式 { value: {...} }
 */
function unwrapBlock(entry) {
  return entry?.value?.value || entry?.value || null
}

function richTextToMarkdown(richText) {
  if (!Array.isArray(richText)) return ''
  return richText
    .map(segment => {
      if (!Array.isArray(segment)) return ''
      const [rawText, annotations] = segment
      let text = typeof rawText === 'string' ? rawText : ''

      // 公式段：['⁍', [['e', 'E=mc^2']]]
      if (rawText === '⁍') {
        const eq = (annotations || []).find(a => a[0] === 'e')
        return eq ? `$${eq[1]}$` : ''
      }
      // 提及段：['‣', [['u', 'uuid']], 0, ['p', ...]]
      if (rawText === '‣') {
        const user = (annotations || []).find(a => a[0] === 'u')
        return user ? `@${user[1]}` : ''
      }

      text = text.replace(/\n/g, ' ')
      if (!Array.isArray(annotations)) return text

      let link = null
      for (const annotation of annotations) {
        if (!Array.isArray(annotation)) continue
        const [kind, value] = annotation
        if (kind === 'a') link = value
        else if (kind === 'b' && text.trim()) text = `**${text}**`
        else if (kind === 'i' && text.trim()) text = `*${text}*`
        else if (kind === 's' && text.trim()) text = `~~${text}~~`
        else if (kind === 'c') text = `\`${text}\``
      }
      // 链接里再包一层，避免 ** 把链接吃掉
      if (link) return `[${text.replace(/^\*\*|\*\*$/g, '')}](${link})`
      return text
    })
    .join('')
}

function getTitle(value, titleKey = 'title') {
  return richTextToMarkdown(value?.properties?.[titleKey])
}

/**
 * 数据库行的属性名是哈希过的（形如 bB{M），真名在 collection.schema 里。
 * 这里找出指定列名对应的哈希键，取不到就退回列名本身。
 */
function resolvePropertyKey(recordMap, propertyName) {
  const collections = recordMap?.collection || {}
  for (const entry of Object.values(collections)) {
    const schema = entry?.value?.schema || entry?.value?.value?.schema || {}
    const key = Object.keys(schema).find(k => schema[k]?.name === propertyName)
    if (key) return key
  }
  return propertyName
}

function resolveTitleKey(recordMap) {
  return resolvePropertyKey(recordMap, 'title')
}

function getPlainProperty(value, key) {
  return richTextToMarkdown(value?.properties?.[key]).trim()
}

function getSourceUrl(value) {
  const source = value?.properties?.source?.[0]?.[0]
  if (typeof source !== 'string') return null
  const caption = richTextToMarkdown(value?.properties?.caption).trim()
  return { source, caption }
}

function childrenOf(value, blockMap) {
  return (Array.isArray(value?.content) ? value.content : [])
    .map(id => ({ id, value: unwrapBlock(blockMap[id]) }))
    .filter(item => item.value)
}

function renderBlocks(blockIds, blockMap, depth = 0) {
  const lines = []
  if (!Array.isArray(blockIds)) return lines
  for (const id of blockIds) {
    const value = unwrapBlock(blockMap[id])
    if (!value) continue
    lines.push(...renderBlock(value, blockMap, depth))
  }
  return lines
}

function renderBlock(value, blockMap, depth = 0) {
  const pad = INDENT.repeat(depth)
  const type = value.type
  const text = getTitle(value)
  const children = childrenOf(value, blockMap)

  switch (type) {
    case 'page':
      // 子页面只留标题与链接，正文已在独立文件里
      return [`${pad}- [${text || '未命名页面'}](/${value.id.replace(/-/g, '')})`]

    case 'header':
      return [`${pad}# ${text}`, '']
    case 'sub_header':
      return [`${pad}## ${text}`, '']
    case 'sub_sub_header':
      return [`${pad}### ${text}`, '']

    case 'text':
      return [text ? `${pad}${text}` : '', '']

    case 'bulleted_list':
      return [
        `${pad}- ${text}`,
        ...renderBlocks(value.content || [], blockMap, depth + 1)
      ]
    case 'numbered_list':
      return [
        `${pad}1. ${text}`,
        ...renderBlocks(value.content || [], blockMap, depth + 1)
      ]
    case 'to_do': {
      const checked = value.properties?.checked?.[0]?.[0] === 'Yes'
      return [`${pad}- [${checked ? 'x' : ' '}] ${text}`]
    }
    case 'toggle':
      return [
        `${pad}- ${text}`,
        ...renderBlocks(value.content || [], blockMap, depth + 1)
      ]
    case 'quote':
      return [`${pad}> ${text}`, '']
    case 'callout': {
      const icon = value.format?.page_icon || '💡'
      return [`${pad}> ${icon} ${text}`, '']
    }
    case 'code': {
      const lang = value.properties?.language?.[0]?.[0] || ''
      return [`${pad}\`\`\`${lang}`, text.replace(/\n$/, ''), `${pad}\`\`\``, '']
    }
    case 'equation':
      return [`${pad}$$`, text, `${pad}$$`, '']
    case 'divider':
      return ['---', '']
    case 'image': {
      const img = getSourceUrl(value)
      if (!img) return []
      return [`${pad}![${img.caption || ''}](${img.source})`, '']
    }
    case 'video':
    case 'audio':
    case 'file':
    case 'pdf': {
      const file = getSourceUrl(value)
      if (!file) return []
      return [`${pad}[${file.caption || file.source}](${file.source})`, '']
    }
    case 'bookmark': {
      const link = value.properties?.link?.[0]?.[0]
      const title = text || link || ''
      return link ? [`${pad}[${title}](${link})`, ''] : []
    }
    case 'table':
      return renderTable(value, blockMap)
    case 'table_row': {
      const cells = value.properties || {}
      const row = Object.keys(cells)
        .filter(key => key.startsWith('title') || /^[a-zA-Z]/.test(key))
        .map(key => richTextToMarkdown(cells[key]).replace(/\|/g, '\\|'))
      return [`| ${row.join(' | ')} |`]
    }
    case 'column_list':
    case 'column':
    case 'transclusion_container':
      return renderBlocks(value.content || [], blockMap, depth)
    case 'collection_view':
    case 'collection_view_page':
      // 内嵌数据库原样搬过去意义不大，RAG 里留个占位就够
      return [`${pad}> （内嵌数据库，未导出）`, '']
    default:
      return text ? [`${pad}${text}`, ''] : []
  }
}

function renderTable(value, blockMap) {
  const rows = (Array.isArray(value.content) ? value.content : [])
    .map(id => unwrapBlock(blockMap[id]))
    .filter(Boolean)
  if (!rows.length) return []
  const toRow = row => {
    const cells = row.properties || {}
    return Object.keys(cells).map(key =>
      richTextToMarkdown(cells[key]).replace(/\|/g, '\\|')
    )
  }
  const head = toRow(rows[0])
  const body = rows.slice(1).map(toRow)
  const lines = [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...body.map(cells => `| ${cells.join(' | ')} |`),
    ''
  ]
  return lines
}

/**
 * 把一篇文章的 recordMap 渲染成 markdown
 * @param {object} recordMap notion-client 的原始返回
 * @param {string} pageId 文章页 id
 * @param {object} meta 额外元信息（标题、日期、标签）
 */
function recordMapToMarkdown(recordMap, pageId, meta = {}) {
  const blockMap = recordMap?.block || {}
  const pageValue = unwrapBlock(blockMap[pageId])
  if (!pageValue) return ''

  const title =
    meta.title || getTitle(pageValue, resolveTitleKey(recordMap)) || ''
  const front = ['---']
  front.push(`title: ${JSON.stringify(title)}`)
  // 只写 slug，不写 url：真实地址由站点按 URL_PREFIX 规则算，
  // 在这里复制一份前缀规则迟早和站点对不上
  if (meta.slug) front.push(`slug: ${JSON.stringify(meta.slug)}`)
  if (meta.date) front.push(`date: ${meta.date}`)
  if (Array.isArray(meta.tags) && meta.tags.length) {
    front.push(`tags: [${meta.tags.map(t => JSON.stringify(t)).join(', ')}]`)
  }
  front.push(`notionId: ${pageId}`)
  front.push('---', '')

  const body = renderBlocks(pageValue.content || [], blockMap)

  return (
    front.join('\n') +
    '\n' +
    body
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() +
    '\n'
  )
}

module.exports = {
  recordMapToMarkdown,
  richTextToMarkdown,
  getTitle,
  getPlainProperty,
  resolvePropertyKey,
  resolveTitleKey
}
