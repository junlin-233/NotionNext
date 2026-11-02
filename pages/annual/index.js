import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import fs from 'fs'
import path from 'path'

/**
 * 年度报告（P4.2）
 *
 * 数据来源：
 * - 文章元数据：fetchGlobalAllData（notion / git 两种模式都通）
 * - 站点阅读量：analytics/history.json（scripts/analytics/snapshot-busuanzi.js 每日归档）
 * - 文章阅读排行：lib/views 的 Redis 排行（没配 Redis 就不显示这一块）
 *
 * 没有页面级历史数据是已知取舍：busuanzi 只给累计值，
 * 所以这里有「站点年度阅读增量」和「文章当前阅读排行」，没有「文章年度阅读」。
 */

const MONTHS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月'
]

function readHistory() {
  try {
    const file = path.join(process.cwd(), 'analytics', 'history.json')
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    return null
  }
}

function buildYearStats(posts, year) {
  const inYear = posts.filter(post => {
    const day = post.publishDay || ''
    return day.startsWith(String(year))
  })

  const monthly = new Array(12).fill(0)
  for (const post of inYear) {
    const month = Number((post.publishDay || '').slice(5, 7))
    if (month >= 1 && month <= 12) monthly[month - 1] += 1
  }

  const tagCount = new Map()
  for (const post of posts) {
    for (const tag of post.tagItems || []) {
      if (!tag?.name) continue
      tagCount.set(tag.name, (tagCount.get(tag.name) || 0) + 1)
    }
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }))

  const sorted = [...posts].sort(
    (a, b) => (a.publishDate || 0) - (b.publishDate || 0)
  )
  const first = sorted[0] || null

  return {
    totalPosts: posts.length,
    yearPosts: inYear.length,
    monthly,
    topTags,
    firstPost: first
      ? { title: first.title, day: first.publishDay, slug: first.slug }
      : null,
    activeMonths: monthly.filter(count => count > 0).length,
    busiestMonth:
      monthly.indexOf(Math.max(...monthly)) > -1
        ? MONTHS[monthly.indexOf(Math.max(...monthly))]
        : ''
  }
}

function buildViewsStats(history, year) {
  if (!history?.points?.length) return null
  const points = history.points
  const inYear = points.filter(point => point.date.startsWith(String(year)))
  const pvDelta = inYear.reduce((sum, point) => sum + (point.pvDelta || 0), 0)
  const uvDelta = inYear.reduce((sum, point) => sum + (point.uvDelta || 0), 0)
  const latest = points[points.length - 1]
  return {
    yearPv: pvDelta,
    yearUv: uvDelta,
    totalPv: latest?.sitePv || 0,
    totalUv: latest?.siteUv || 0,
    since: points[0]?.date || null,
    trend: inYear.map(point => ({
      date: point.date,
      pv: point.pvDelta || 0
    }))
  }
}

const StatCard = ({ label, value, hint }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-[#1e1e1e]'>
    <div className='text-2xl font-bold text-gray-800 dark:text-gray-100'>
      {value}
    </div>
    <div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>{label}</div>
    {hint && (
      <div className='mt-1 text-xs text-gray-400 dark:text-gray-500'>{hint}</div>
    )}
  </div>
)

const Annual = props => {
  const {
    year,
    stats,
    views,
    topPosts,
    viewsEnabled,
    siteTitle,
    siteLink
  } = props
  const maxMonthly = Math.max(1, ...(stats?.monthly || [1]))

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6 px-5 py-8 md:px-0'>
      <header className='rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-[#1e1e1e]'>
        <p className='text-sm text-gray-400'>{siteTitle}</p>
        <h1 className='mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100'>
          {year} 年度报告
        </h1>
        <p className='mt-3 text-gray-500 dark:text-gray-400'>
          {stats?.yearPosts
            ? `${year} 年写了 ${stats.yearPosts} 篇，累计 ${stats.totalPosts} 篇。`
            : `还没有 ${year} 年的新文章，先看看过去的积累。`}
        </p>
        <a
          className='mt-4 inline-block text-sm text-red-500 hover:underline'
          href={`/api/og-annual?year=${year}`}
          target='_blank'
          rel='noreferrer'>
          生成分享卡 →
        </a>
      </header>

      <section className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <StatCard
          label='文章总数'
          value={stats?.totalPosts || 0}
          hint={`今年新增 ${stats?.yearPosts || 0}`}
        />
        <StatCard
          label='年度阅读'
          value={views ? views.yearPv : '—'}
          hint={views ? `访客 ${views.yearUv}` : '统计归档未开始'}
        />
        <StatCard
          label='累计阅读'
          value={views ? views.totalPv : '—'}
          hint={views?.since ? `自 ${views.since} 起归档` : ''}
        />
        <StatCard
          label='活跃月份'
          value={`${stats?.activeMonths || 0}/12`}
          hint={stats?.busiestMonth ? `最勤快：${stats.busiestMonth}` : ''}
        />
      </section>

      <section className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-[#1e1e1e]'>
        <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-100'>
          月度发文
        </h2>
        <div className='flex items-end gap-2'>
          {(stats?.monthly || []).map((count, index) => (
            <div key={index} className='flex flex-1 flex-col items-center gap-1'>
              <div
                className='w-full rounded-t bg-red-400/80 dark:bg-red-500/70'
                style={{
                  height: `${Math.max(4, (count / maxMonthly) * 90)}px`
                }}
                title={`${MONTHS[index]}：${count} 篇`}
              />
              <span className='text-[10px] text-gray-400'>
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      {stats?.topTags?.length > 0 && (
        <section className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-[#1e1e1e]'>
          <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-100'>
            最常写的标签
          </h2>
          <div className='flex flex-wrap gap-2'>
            {stats.topTags.map(tag => (
              <a
                key={tag.name}
                href={`/tag/${encodeURIComponent(tag.name)}`}
                className='rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:border-red-400 hover:text-red-500 dark:border-gray-600 dark:text-gray-300'>
                {tag.name}
                <span className='ml-1 text-xs text-gray-400'>{tag.count}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {viewsEnabled && topPosts?.length > 0 && (
        <section className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-[#1e1e1e]'>
          <h2 className='mb-4 text-lg font-bold text-gray-800 dark:text-gray-100'>
            阅读排行
          </h2>
          <ol className='space-y-2'>
            {topPosts.map((post, index) => (
              <li key={post.id} className='flex items-baseline gap-3 text-sm'>
                <span className='w-6 shrink-0 text-gray-400'>
                  {index + 1}
                </span>
                <a
                  href={post.href || `/${post.slug}`}
                  className='flex-grow truncate text-gray-700 hover:text-red-500 dark:text-gray-200'>
                  {post.title}
                </a>
                <span className='shrink-0 text-xs text-gray-400'>
                  {post.views} 次
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className='pb-8 text-center text-xs text-gray-400'>
        {stats?.firstPost ? (
          <>
            第一篇文章写于 {stats.firstPost.day}：
            <a
              className='hover:text-red-500'
              href={`/${stats.firstPost.slug}`}>
              {stats.firstPost.title}
            </a>
          </>
        ) : null}
        {siteLink ? (
          <div className='mt-2'>
            <a className='hover:text-red-500' href={siteLink}>
              {siteLink}
            </a>
          </div>
        ) : null}
      </footer>
    </div>
  )
}

export async function getStaticProps({ locale }) {
  const { getTopViews, isViewsEnabled } = await import('@/lib/views')
  const props = await fetchGlobalAllData({ from: 'annual', locale })
  const posts = (props.allPages || []).filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  delete props.allPages

  const year = new Date().getFullYear()
  const stats = buildYearStats(posts, year)
  const views = buildViewsStats(readHistory(), year)

  const viewsEnabled = isViewsEnabled()
  let topPosts = []
  if (viewsEnabled) {
    const ranked = await getTopViews(40)
    const viewMap = new Map(ranked.map(item => [item.slug, item.count]))
    topPosts = posts
      .map(post => ({ ...post, views: viewMap.get(post.slug) || 0 }))
      .filter(post => post.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
  }

  return {
    props: {
      ...props,
      year,
      stats,
      views,
      topPosts,
      viewsEnabled,
      siteTitle: props.siteInfo?.title || '我的博客',
      siteLink: props.siteInfo?.link || ''
    },
    revalidate: process.env.EXPORT ? undefined : 3600
  }
}

export default Annual
