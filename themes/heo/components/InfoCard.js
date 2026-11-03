import { ArrowRightCircle } from '@/components/HeroIcons'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'
import { useState } from 'react'
import CONFIG from '../config'
import Announcement from './Announcement'
import Card from './Card'

/**
 * 社交信息卡
 * @param {*} props
 * @returns
 */
export function InfoCard(props) {
  const { notice } = props
  const url1 = siteConfig('HEO_INFO_CARD_URL1', null, CONFIG)
  const icon1 = siteConfig('HEO_INFO_CARD_ICON1', null, CONFIG)
  const url2 = siteConfig('HEO_INFO_CARD_URL2', null, CONFIG)
  const icon2 = siteConfig('HEO_INFO_CARD_ICON2', null, CONFIG)
  const tagline = siteConfig('HEO_INFO_CARD_TAGLINE', '', CONFIG)
  return (
    <Card className='scroll-reveal scroll-fade-in-up bg-[#4f65f0] dark:bg-yellow-600 text-white flex flex-col w-72 overflow-hidden relative'>
      {/* 问候语 */}
      <GreetingsWords />

      <h2 className='text-3xl font-extrabold mt-3'>{siteConfig('AUTHOR')}</h2>

      {/* 一句话签名 */}
      {tagline && <div className='mt-2 text-sm text-white/80'>{tagline}</div>}

      {/* 公告栏 */}
      <Announcement post={notice} style={{ color: 'white !important' }} />

      <div className='flex justify-between mt-5'>
        <div className='flex space-x-3  hover:text-black dark:hover:text-white'>
          {/* 两个社交按钮 */}
          {url1 && (
            <div className='w-10 text-center bg-indigo-400 p-2 rounded-full  transition-colors duration-200 dark:bg-yellow-500 dark:hover:bg-black hover:bg-white'>
              <SmartLink href={url1}>
                <i className={icon1} />
              </SmartLink>
            </div>
          )}
          {url2 && (
            <div className='bg-indigo-400 p-2 rounded-full w-10 items-center flex justify-center transition-colors duration-200 dark:bg-yellow-500 dark:hover:bg-black hover:bg-white'>
              <SmartLink href={url2}>
                <i className={icon2} />
              </SmartLink>
            </div>
          )}
        </div>
        {/* 第三个按钮 */}
        <MoreButton />
      </div>
    </Card>
  )
}

/**
 * 了解更多按鈕
 * @returns
 */
function MoreButton() {
  const url3 = siteConfig('HEO_INFO_CARD_URL3', null, CONFIG)
  const text3 = siteConfig('HEO_INFO_CARD_TEXT3', null, CONFIG)
  if (!url3) {
    return <></>
  }
  return (
    <SmartLink href={url3}>
      <div
        className={
          'group bg-indigo-400 dark:bg-yellow-500 hover:bg-white dark:hover:bg-black hover:text-black dark:hover:text-white flex items-center transition-colors duration-200 py-2 px-3 rounded-full space-x-1'
        }>
        <ArrowRightCircle
          className={
            'group-hover:stroke-black dark:group-hover:stroke-white w-6 h-6 transition-all duration-100'
          }
        />
        <div className='font-bold'>{text3}</div>
      </div>
    </SmartLink>
  )
}

/**
 * 欢迎语
 */
function GreetingsWords() {
  const greetings = siteConfig('HEO_INFOCARD_GREETINGS', null, CONFIG)
  const [greeting, setGreeting] = useState(greetings[0])
  // 每次点击，随机获取greetings中的一个
  const handleChangeGreeting = () => {
    const randomIndex = Math.floor(Math.random() * greetings.length)
    setGreeting(greetings[randomIndex])
  }

  return (
    <div
      onClick={handleChangeGreeting}
      className='w-fit select-none cursor-pointer py-1 px-2 bg-indigo-400 hover:bg-indigo-50 hover:text-indigo-950 dark:bg-yellow-500 dark:hover:text-white dark:hover:bg-black text-sm rounded-lg duration-200 transition-colors'>
      {greeting}
    </div>
  )
}
