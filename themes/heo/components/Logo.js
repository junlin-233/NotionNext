import { Home } from '@/components/HeroIcons'
import { siteConfig } from '@/lib/config'
import SmartLink from '@/components/SmartLink'

/**
 * 左上角 Logo
 * 房子图标的形状保持原样，底色换成白底黑线、暗色下反过来。
 */
const Logo = () => {
  return (
    <SmartLink href='/' passHref legacyBehavior>
      <div
        id='logo-home'
        title={siteConfig('TITLE')}
        className='flex flex-none items-center justify-center w-16 md:w-[70px] h-10 md:h-11 rounded-2xl bg-white ring-1 ring-black/[0.07] shadow-[0_2px_6px_rgba(16,24,40,0.08)] hover:ring-black/10 hover:shadow-[0_4px_14px_rgba(16,24,40,0.14)] dark:bg-[#23232b] dark:ring-white/10 dark:hover:ring-white/20 duration-200 transition-all cursor-pointer'>
        <Home className={'w-6 h-6 stroke-black dark:stroke-white stroke-2'} />
      </div>
    </SmartLink>
  )
}
export default Logo
