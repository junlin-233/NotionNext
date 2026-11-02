import { withOgSign, signOgParams, verifyOgParams, isOgSignEnabled } from '@/lib/og/sign'
import crypto from 'crypto'

describe('lib/og/sign', () => {
  const KEY = 'test-og-secret'

  beforeAll(() => {
    process.env.OG_SIGN_KEY = KEY
  })
  afterAll(() => {
    delete process.env.OG_SIGN_KEY
  })

  test('未配 Key 时不签名', () => {
    delete process.env.OG_SIGN_KEY
    expect(isOgSignEnabled()).toBe(false)
    expect(signOgParams({ title: 'a' })).toBe('')
    expect(withOgSign({ title: 'a' })).toEqual({ title: 'a' })
    process.env.OG_SIGN_KEY = KEY
  })

  test('签名口径：除 sign 外参数按 key 排序，k=v 逐行 join，HMAC-SHA256 hex', () => {
    const params = { site: '站', title: '标题', sub: '摘要' }
    const expected = crypto
      .createHmac('sha256', KEY)
      .update('site=站\nsub=摘要\ntitle=标题')
      .digest('hex')
    expect(signOgParams(params)).toBe(expected)
  })

  test('空值与 sign 本身不参与签名', () => {
    const a = signOgParams({ title: 'x', sub: '' })
    const b = signOgParams({ title: 'x', sign: 'whatever' })
    expect(a).toBe(b)
    expect(a).not.toBe('')
  })

  test('withOgSign 返回带 sign 的完整参数', () => {
    const out = withOgSign({ title: 'x' })
    expect(out.title).toBe('x')
    expect(out.sign).toMatch(/^[0-9a-f]{64}$/)
  })

  test('verifyOgParams：签名正确通过、篡改拒绝、未配 Key 恒真', () => {
    const signed = withOgSign({ title: 't', sub: 's' })
    expect(verifyOgParams(signed)).toBe(true)
    expect(verifyOgParams({ ...signed, title: '篡改' })).toBe(false)
    expect(verifyOgParams({ title: 't' })).toBe(false)
    delete process.env.OG_SIGN_KEY
    expect(verifyOgParams({ title: 't' })).toBe(true)
    process.env.OG_SIGN_KEY = KEY
  })
})
