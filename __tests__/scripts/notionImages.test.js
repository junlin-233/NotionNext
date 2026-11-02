/**
 * notion-images 测试
 *
 * 这两个函数出错会直接导致「每天同步都新增一堆重复图片」和「图片全部 403」，
 * 所以按真实 Notion 地址形态写死用例。
 */
const {
  normalizeImageKey,
  looksLikeImage,
  collectImageSources,
  applyImageMap,
  resolveDownloadUrl,
  guessExt
} = require('../../scripts/lib/notion-images.cjs')

const SIGNED_S3 =
  'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/abc/pic.png?X-Amz-Signature=aaa&X-Amz-Expires=3600&X-Amz-Date=20261102'
const SIGNED_S3_NEW_SIG =
  'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/abc/pic.png?X-Amz-Signature=bbb&X-Amz-Expires=3600&X-Amz-Date=20261103'

describe('notion-images', () => {
  test('签名参数不参与去重 key', () => {
    expect(normalizeImageKey(SIGNED_S3)).toBe(
      normalizeImageKey(SIGNED_S3_NEW_SIG)
    )
  })

  test('attachment 只保留 id', () => {
    expect(normalizeImageKey('attachment:abc-123:hello.png')).toBe(
      'attachment:abc-123'
    )
    expect(normalizeImageKey('attachment:abc-123:renamed.png')).toBe(
      'attachment:abc-123'
    )
  })

  test('notion /image 地址里层签名也被归一化', () => {
    const one = `https://www.notion.so/image/${encodeURIComponent(SIGNED_S3)}?table=block&id=1`
    const two = `https://www.notion.so/image/${encodeURIComponent(SIGNED_S3_NEW_SIG)}?table=block&id=1`
    expect(normalizeImageKey(one)).toBe(normalizeImageKey(two))
  })

  test('识别图片与跳过占位图', () => {
    expect(looksLikeImage(SIGNED_S3)).toBe(true)
    expect(looksLikeImage('attachment:x:y.png')).toBe(true)
    expect(looksLikeImage('https://example.com/a.txt')).toBe(false)
    expect(looksLikeImage('https://source.unsplash.com/random')).toBe(false)
  })

  test('收集与回填', () => {
    const recordMap = {
      block: {
        b1: { value: { value: { id: 'b1', type: 'image', properties: { source: [[SIGNED_S3]] } } } }
      }
    }
    const sources = collectImageSources(recordMap)
    expect(sources.size).toBe(1)

    const key = normalizeImageKey(SIGNED_S3)
    const rewritten = applyImageMap(recordMap, new Map([[key, '/images/notion/x.png']]))
    expect(rewritten.block.b1.value.value.properties.source[0][0]).toBe(
      '/images/notion/x.png'
    )
    // 原对象不被修改
    expect(recordMap.block.b1.value.value.properties.source[0][0]).toBe(
      SIGNED_S3
    )
  })

  test('下载地址：attachment 走 signed，S3 裸链走 image', () => {
    const attachment = resolveDownloadUrl('attachment:aaa:pic.png', 'block-1')
    expect(attachment).toContain('https://www.notion.so/signed/')
    expect(attachment).toContain('table=block')
    expect(attachment).toContain('id=block-1')

    const bare = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/a/b.png'
    const signed = resolveDownloadUrl(bare, 'block-1')
    expect(signed).toContain('https://www.notion.so/image/')
    expect(signed).toContain('id=block-1')

    // 已经带签名的直链保持原样
    expect(resolveDownloadUrl(SIGNED_S3, 'block-1')).toBe(SIGNED_S3)
  })

  test('扩展名优先取 content-type', () => {
    expect(guessExt('https://a/b', 'image/webp')).toBe('webp')
    expect(guessExt('https://a/b.jpeg', '')).toBe('jpg')
    expect(guessExt('https://a/b', '')).toBe('jpg')
  })
})
