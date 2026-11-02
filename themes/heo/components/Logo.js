import { Home } from '@/components/HeroIcons'
import { siteConfig } from '@/lib/config'
import SmartLink from '@/components/SmartLink'

/**
 * 左上角 Logo
 * 不带底色，和右侧的搜索、暗色模式按钮同规格：40px 圆形热区 + 24px 线条图标，
 * 颜色跟随导航栏文字，文章页封面上一并变白。
 */
const Logo = () => {
  return (
    <SmartLink href='/' passHref legacyBehavior>
      <div
        id='logo-home'
        title={siteConfig('TITLE')}
        className='cursor-pointer hover:bg-black hover:bg-opacity-10 rounded-full w-10 h-10 flex flex-none justify-center items-center duration-200 transition-all'>
        <Home className='w-5 h-5' />
      </div>
    </SmartLink>
  )
}
export default Logo
