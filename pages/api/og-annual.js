import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { withOgSign } from '@/lib/og/sign'
import fs from 'fs'
import path from 'path'

/**
 * 年度报告分享卡（P4.2 → 计划 4.3 防滥用补齐）
 *
 * GET /api/og-annual?year=2026
 * 服务端取数（文章数 + 累计阅读量）拼出标题/摘要，用 OG_SIGN_KEY 签名后
 * 302 跳转到 /api/og。签名不进前端，密钥不暴露。
 *
 * 与 pages/annual/index.js 的客户端数字口径一致：
 * - 文章数：fetchGlobalAllData 的全部文章
 * - 阅读量：analytics/history.json 最新一条的累计 sitePv
 */

const readHistory = () => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'analytics', 'history.json'), 'utf8')
    )
  } catch (e) {
    return null
  }
}

const latestSitePv = history => {
  const entries = Array.isArray(history?.points) ? history.points : []
  const last = entries[entries.length - 1]
  return last?.sitePv || 0
}

export default async function handler(req, res) {
  const year = String(req.query.year || new Date().getFullYear()).slice(0, 4)
  const siteTitle =
    process.env.NEXT_PUBLIC_TITLE || 'junlin 的博客'

  let totalPosts = 0
  let totalPv = 0
  try {
    const locale = req.query.locale || 'zh-CN'
    const result = await fetchGlobalAllData({
      from: 'api/og-annual',
      locale
    })
    // 运行时 allPages 的条目不带 type 数组（构建期才有），直接用 postCount
    totalPosts = Number(result?.postCount) || 0
  } catch (e) {
    console.warn('[api/og-annual] 取文章数失败:', e?.message || e)
  }
  try {
    totalPv = latestSitePv(readHistory())
  } catch (e) {
    console.warn('[api/og-annual] 取阅读量失败:', e?.message || e)
  }

  const params = withOgSign({
    title: `${siteTitle} ${year} 年度报告`,
    sub: `${totalPosts} 篇文章 · 累计 ${totalPv} 次阅读`,
    site: siteTitle
  })

  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.redirect(302, `/api/og?${new URLSearchParams(params).toString()}`)
}
