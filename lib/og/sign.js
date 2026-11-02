import crypto from 'crypto'

/**
 * OG 端点 HMAC 签名（计划 4.3 防滥用）
 *
 * 签名对象：除 sign 外的全部查询参数（解码后的值），按 key 排序后
 * 以 "k=v" 每行一条拼接，HMAC-SHA256，hex 输出。
 * SEO.js / api/og-annual.js（Node，签名）与 pages/api/og.js（Edge，验签）共用此口径；
 * Edge 端用 Web Crypto 按同口径重算，见 og.js 内的 verifySignature。
 *
 * OG_SIGN_KEY 未配置时不签名、不验签，端点保持开放（本地 / 未配 Key 的部署）。
 */

export function getOgSignKey() {
  return process.env.OG_SIGN_KEY || ''
}

export function isOgSignEnabled() {
  return Boolean(getOgSignKey())
}

function canonicalMessage(params) {
  return Object.keys(params)
    .filter(key => key !== 'sign' && params[key] != null && String(params[key]) !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('\n')
}

export function signOgParams(params) {
  const key = getOgSignKey()
  if (!key) return ''
  return crypto
    .createHmac('sha256', key)
    .update(canonicalMessage(params))
    .digest('hex')
}

/**
 * 给一组参数补上签名，返回可直接 querystring 化的对象
 */
export function withOgSign(params) {
  const sign = signOgParams(params)
  if (!sign) return { ...params }
  return { ...params, sign }
}
