import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import CONFIG from '../config'
import Swipe from './Swipe'

/**
 * 通知横幅
 */
export function NoticeBar() {
  let notices = siteConfig('HEO_NOTICE_BAR', null, CONFIG)
  if (typeof notices === 'string') {
    notices = JSON.parse(notices)
  }
  if (!notices || notices?.length === 0) {
    return <></>
  }

  return (
    <div className='max-w-[86rem] w-full mx-auto flex h-12 mb-4 px-5 font-bold'>
      <div className='animate__animated animate__fadeIn animate__fast group bg-white dark:bg-[#1e1e1e] dark:text-white border dark:border-gray-700 duration-200 rounded-xl w-full h-full flex items-center justify-center px-5'>
        <div className='w-full h-full flex justify-center items-center'>
          <Swipe items={notices} />
        </div>
      </div>
    </div>
  )
}
