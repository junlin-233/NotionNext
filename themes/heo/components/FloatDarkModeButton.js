import { useGlobal } from '@/lib/global'
import CONFIG from '../config'
import { siteConfig } from '@/lib/config'

export default function FloatDarkModeButton() {
  const { isDarkMode, toggleDarkMode } = useGlobal()

  if (!siteConfig('HEO_WIDGET_DARK_MODE', null, CONFIG)) {
    return <></>
  }

  return (
    <div
      onClick={toggleDarkMode}
      className={
        'justify-center items-center w-7 h-7 text-center transform hover:scale-105 duration-200'
      }>
      <i
        id='darkModeButton'
        className={`${isDarkMode ? 'fa-sun' : 'fa-moon'} fas text-xs`}
      />
    </div>
  )
}
