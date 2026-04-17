jest.mock('notion-utils', () => ({
  getTextContent: value => value?.[0]?.[0] ?? ''
}))

const {
  getPageTableOfContents
} = require('@/lib/db/notion/getPageTableOfContents')

describe('getPageTableOfContents', () => {
  it('ignores unknown header-like block types without crashing', () => {
    const page = {
      content: ['unknown-header', 'real-sub-header']
    }

    const recordMap = {
      block: {
        'unknown-header': {
          value: {
            id: 'unknown-header',
            type: 'collection_header',
            properties: {
              title: [['Ignored heading']]
            }
          }
        },
        'real-sub-header': {
          value: {
            id: 'real-sub-header',
            type: 'sub_header',
            properties: {
              title: [['Actual heading']]
            }
          }
        }
      }
    }

    expect(getPageTableOfContents(page, recordMap)).toEqual([
      {
        id: 'real-sub-header',
        type: 'sub_header',
        text: 'Actual heading',
        indentLevel: 0
      }
    ])
  })

  it('keeps the indent stack stable when heading levels decrease sharply', () => {
    const page = {
      content: ['h3', 'h1']
    }

    const recordMap = {
      block: {
        h3: {
          value: {
            id: 'h3',
            type: 'sub_sub_header',
            properties: {
              title: [['Deep heading']]
            }
          }
        },
        h1: {
          value: {
            id: 'h1',
            type: 'header',
            properties: {
              title: [['Top heading']]
            }
          }
        }
      }
    }

    expect(getPageTableOfContents(page, recordMap)).toEqual([
      {
        id: 'h3',
        type: 'sub_sub_header',
        text: 'Deep heading',
        indentLevel: 0
      },
      {
        id: 'h1',
        type: 'header',
        text: 'Top heading',
        indentLevel: 0
      }
    ])
  })
})
