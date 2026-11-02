import dynamic from 'next/dynamic'
import Card from './Card'
import Catalog from './Catalog'
import { InfoCard } from './InfoCard'
import LatestPostsGroupMini from './LatestPostsGroupMini'
import TagGroups from './TagGroups'

// 侧栏里这些块都在首屏之外的折叠区，且没有 SEO 价值：
// Live2D 要拉 canvas 与外部脚本，TouchMeCard/AnalyticsCard 只是装饰性卡片。
// 拆成独立 chunk 后延迟加载，不进首屏 JS。
const Live2D = dynamic(() => import('@/components/Live2D'), { ssr: false })
const TouchMeCard = dynamic(() => import('./TouchMeCard'), { ssr: false })
const AnalyticsCardLazy = dynamic(
  () => import('./AnalyticsCard').then(m => m.AnalyticsCard),
  { ssr: false }
)

/**
 * Hexo主题右侧栏
 * @param {*} props
 * @returns
 */
export default function SideRight(props) {
  const { post, tagOptions, currentTag, rightAreaSlot } = props

  // 只摘取标签的前60个，防止右侧过长
  const sortedTags = tagOptions?.slice(0, 60) || []

  return (
    <div id='sideRight' className='hidden xl:block w-72 space-y-4 h-full'>
      <InfoCard {...props} className='w-72 scroll-reveal scroll-fade-in-up' />

      <div className='sticky top-20 space-y-4'>
        {/* 文章页显示目录 */}
        {post && post.toc && post.toc.length > 0 && (
          <Card className='bg-white dark:bg-[#1e1e1e] scroll-reveal scroll-fade-in-up'>
            <Catalog toc={post.toc} />
          </Card>
        )}

        {/* 联系交流群 */}
        <div className='scroll-reveal scroll-fade-in-up'>
          <TouchMeCard />
        </div>

        {/* 最新文章列表 */}
        <div
          className={
            'border scroll-reveal scroll-fade-in-up  hover:border-indigo-600  dark:hover:border-yellow-600 duration-200 dark:border-gray-700 dark:bg-[#1e1e1e] dark:text-white rounded-xl lg:p-6 p-4 hidden lg:block bg-white'
          }>
          <LatestPostsGroupMini {...props} />
        </div>

        {rightAreaSlot}

        <Live2D />

        {/* 标签和成绩 */}
        <Card
          className={
            'bg-white dark:bg-[#1e1e1e] dark:text-white hover:border-indigo-600  dark:hover:border-yellow-600 duration-200'
          }>
          <TagGroups tags={sortedTags} currentTag={currentTag} />
          <hr className='mx-1 flex border-dashed relative my-4' />
          <AnalyticsCardLazy {...props} />
        </Card>
      </div>
    </div>
  )
}
