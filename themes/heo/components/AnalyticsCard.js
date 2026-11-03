import history from '@/analytics/history.json'
import CONFIG from '../config'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import busuanzi from '@/lib/plugins/busuanzi'
import { useEffect, useState } from 'react'

/**
 * 兜底访客数：analytics/history.json 是每天归档的 busuanzi 累计值（GitHub Action 更新）。
 * busuanzi 的 JSONP 响应是 text/html，Chrome 的 ORB 会随机把脚本拦掉（实测三次里挂一次），
 * 拦掉时页面上就没有访客数；先用归档值顶上，实时数据回来后会覆盖。
 */
const archivedVisitorCount = (() => {
  const points = history?.points || []
  const last = points[points.length - 1]
  return last?.siteUv ?? null
})()

/**
 * 博客统计卡牌
 * @param {*} props
 * @returns
 */
export function AnalyticsCard(props) {
  const targetDate = new Date(siteConfig('HEO_SITE_CREATE_TIME', null, CONFIG))
  const today = new Date()
  const diffTime = today.getTime() - targetDate.getTime() // 获取两个日期之间的毫秒数差值
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) // 将毫秒数差值转换为天数差值
  const postCountTitle = siteConfig('HEO_POST_COUNT_TITLE', null, CONFIG)
  const siteTimeTitle = siteConfig('HEO_SITE_TIME_TITLE', null, CONFIG)
  const siteVisitorTitle = siteConfig('HEO_SITE_VISITOR_TITLE', null, CONFIG)

  // 访客数（UV）。这张卡是懒加载的，挂载时机可能比不蒜子回填更晚，
  // 靠 .busuanzi_container_site_uv 那段 DOM 会被漏掉（看到的就是没有访客数），
  // 所以直接订阅不蒜子已经取回的数据；订阅不会多打一次接口，不会虚增 PV。
  const { NOTION_CONFIG } = useGlobal()
  const [siteUv, setSiteUv] = useState(archivedVisitorCount)
  useEffect(() => {
    if (siteConfig('ANALYTICS_BUSUANZI_ENABLE', true, NOTION_CONFIG)) {
      return busuanzi.subscribe(data => {
        if (data?.site_uv !== undefined && data?.site_uv !== null) {
          setSiteUv(data.site_uv)
        }
      })
    }

    // 关掉不蒜子时退回站内统计接口 /api/stats
    let cancelled = false
    fetch('/api/stats?path=/')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.siteUv !== undefined && data?.siteUv !== null) {
          setSiteUv(data.siteUv)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [NOTION_CONFIG])

  const { postCount } = props
  return <>
        <div className='text-md flex flex-col space-y-1 justify-center px-3'>
            <div className='inline'>
                <div className='flex justify-between'>
                    <div>{postCountTitle}</div>
                    <div>{postCount}</div>
                </div>
            </div>
            <div className='inline'>
                <div className='flex justify-between'>
                    <div>{siteTimeTitle}</div>
                    <div>{diffDays} 天</div>
                </div>
            </div>
            {siteUv !== null && (
                <div className='flex justify-between'>
                    <div>{siteVisitorTitle}</div>
                    <div>{siteUv}</div>
                </div>
            )}
        </div>
        </>
}
