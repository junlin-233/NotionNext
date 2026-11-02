import LazyImage from '@/components/LazyImage'
import SmartLink from '@/components/SmartLink'
// import TagItemMini from './TagItemMini'

/**
 * 热门文章一行
 * @param {*} props post 文章；rank 排名；showViews 是否显示阅读数
 */
export default function BlogPostHot({ post, rank, showViews = true }) {
  if (!post) return null
  const cover = post.pageCoverThumbnail || post.pageCover
  const isTop = rank <= 3

  return (
    <div className='flex items-center gap-2 sm:gap-3 mb-4 group w-full'>
      {/* 排名 */}
      <div
        className={`w-5 sm:w-7 shrink-0 text-center font-extrabold ${
          isTop
            ? 'text-indigo-600 dark:text-yellow-500'
            : 'text-gray-300 dark:text-gray-600'
        }`}>
        {rank}
      </div>

      {/* 封面（手机端不显示，省出标题宽度） */}
      {cover && (
        <SmartLink href={post.href} className='hidden sm:block shrink-0'>
          <LazyImage className='rounded-xl bg-center bg-cover w-32 h-20' src={cover} />
        </SmartLink>
      )}

      {/* 标题 + 标签 */}
      <div className='flex-1 min-w-0'>
        <SmartLink
          href={post.href}
          className='block group-hover:text-indigo-700 dark:group-hover:text-yellow-600 text-black dark:text-gray-100 line-clamp-2 replace cursor-pointer text-base sm:text-lg font-extrabold leading-tight'>
          {post.title}
        </SmartLink>
        <div className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400'>
          {post.category && <span>{post.category}</span>}
          {post.publishDay && <span>{post.publishDay}</span>}
        </div>
      </div>

      {/* 阅读数 */}
      {showViews && (
        <div className='shrink-0 text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
          <i className='fa-solid fa-fire-flame-curved'></i>{' '}
          <span>{(post.views || 0).toLocaleString('zh-CN')}</span>
        </div>
      )}
    </div>
  )
}
