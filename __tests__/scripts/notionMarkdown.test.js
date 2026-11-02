/**
 * notion-markdown 转换测试
 *
 * 重点覆盖容易出错的三处：
 * 1. block 双层嵌套（{value:{value:{...}}}）解包
 * 2. 哈希属性名要通过 schema 才能取到 title
 * 3. 列表/表格等带 content 的块，content 缺失时不能把整个转换搞崩
 */
const {
  recordMapToMarkdown,
  getTitle,
  getPlainProperty,
  resolvePropertyKey
} = require('../../scripts/lib/notion-markdown.cjs')

const PAGE_ID = '8f4fe6b1-7a9e-43e0-bcfb-6edb50f10a62'

function wrap(value) {
  return { spaceId: 'space', value: { value, role: 'editor' } }
}

function rich(text, annotations = []) {
  return [[text, annotations]]
}

function buildRecordMap(blocks) {
  const map = {}
  for (const block of blocks) {
    map[block.id] = wrap(block)
  }
  return { block: map }
}

describe('notion-markdown', () => {
  test('解包双层嵌套并渲染常见块', () => {
    const recordMap = buildRecordMap([
      {
        id: PAGE_ID,
        type: 'page',
        properties: { title: rich('测试文章') },
        content: ['h1', 'p1', 'list', 'code']
      },
      { id: 'h1', type: 'header', properties: { title: rich('一级标题') }, content: [] },
      { id: 'p1', type: 'text', properties: { title: rich('正文段落') }, content: [] },
      {
        id: 'list',
        type: 'bulleted_list',
        properties: { title: rich('列表项') },
        content: ['list-child']
      },
      {
        id: 'list-child',
        type: 'bulleted_list',
        properties: { title: rich('子项') },
        content: []
      },
      {
        id: 'code',
        type: 'code',
        properties: { title: rich('const a = 1'), language: [['javascript']] },
        content: []
      }
    ])

    const markdown = recordMapToMarkdown(recordMap, PAGE_ID)

    expect(markdown).toContain('title: "测试文章"')
    expect(markdown).toContain('notionId: ' + PAGE_ID)
    expect(markdown).toContain('# 一级标题')
    expect(markdown).toContain('正文段落')
    expect(markdown).toContain('- 列表项')
    expect(markdown).toContain('  - 子项')
    expect(markdown).toContain('```javascript')
  })

  test('行属性被哈希时用 schema 取标题', () => {
    const recordMap = {
      block: {
        [PAGE_ID]: wrap({
          id: PAGE_ID,
          type: 'page',
          properties: { 'bB{M': rich('哈希标题'), 'd]hq': rich('article/hello') },
          content: []
        })
      },
      collection: {
        col: wrap({
          schema: {
            'bB{M': { name: 'title', type: 'title' },
            'd]hq': { name: 'slug', type: 'text' }
          }
        })
      }
    }

    const value = recordMap.block[PAGE_ID].value.value
    expect(resolvePropertyKey(recordMap, 'title')).toBe('bB{M')
    expect(getTitle(value, 'bB{M')).toBe('哈希标题')
    expect(getPlainProperty(value, 'd]hq')).toBe('article/hello')
  })

  test('content 缺失或非数组时不抛错', () => {
    const recordMap = buildRecordMap([
      {
        id: PAGE_ID,
        type: 'page',
        properties: { title: rich('空内容') },
        content: undefined
      },
      { id: 'quote', type: 'quote', properties: { title: rich('引用'), content: null } }
    ])

    expect(() => recordMapToMarkdown(recordMap, PAGE_ID)).not.toThrow()
    const markdown = recordMapToMarkdown(recordMap, PAGE_ID)
    expect(markdown).toContain('title: "空内容"')
  })

  test('表格渲染成 markdown 表格', () => {
    const recordMap = buildRecordMap([
      {
        id: PAGE_ID,
        type: 'page',
        properties: { title: rich('表格') },
        content: ['table']
      },
      { id: 'table', type: 'table', properties: {}, content: ['r1', 'r2'] },
      { id: 'r1', type: 'table_row', properties: { a: rich('列1'), b: rich('列2') }, content: [] },
      { id: 'r2', type: 'table_row', properties: { a: rich('值1'), b: rich('值2') }, content: [] }
    ])

    const markdown = recordMapToMarkdown(recordMap, PAGE_ID)
    expect(markdown).toContain('| 列1 | 列2 |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| 值1 | 值2 |')
  })

  test('只写 slug，不写 url（地址由站点按 URL_PREFIX 规则算）', () => {
    const recordMap = buildRecordMap([
      {
        id: PAGE_ID,
        type: 'page',
        properties: { title: rich('带链接') },
        content: []
      }
    ])
    const markdown = recordMapToMarkdown(recordMap, PAGE_ID, {
      title: '带链接',
      slug: 'article/with-link',
      url: '/zh-CN/article/with-link'
    })
    expect(markdown).toContain('slug: "article/with-link"')
    expect(markdown).not.toContain('url:')
  })
})
