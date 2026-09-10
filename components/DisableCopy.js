import { siteConfig } from '@/lib/config'
import { useEffect } from 'react'

/**
 * 禁止用户拷贝文章的插件
 */
export default function DisableCopy() {
  useEffect(() => {
    if (!siteConfig('CAN_COPY')) {
      // 全栈添加禁止复制的样式
      const html = document.documentElement
      html.classList.add('forbid-copy')
      const handleCopy = event => {
        event.preventDefault()
        alert('抱歉，本网页内容不可复制！')
      }
      // 监听复制事件
      document.addEventListener('copy', handleCopy)

      return () => {
        html.classList.remove('forbid-copy')
        document.removeEventListener('copy', handleCopy)
      }
    }
  }, [])

  return null
}
