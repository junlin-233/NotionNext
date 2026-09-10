import { useGlobal } from '@/lib/global'
import throttle from 'lodash.throttle'
import { uuidToId } from 'notion-utils'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * 目录导航组件
 * @param toc
 * @returns {JSX.Element}
 * @constructor
 */
const Catalog = ({ toc }) => {
  const { locale } = useGlobal()
  const tRef = useRef(null)
  const [activeSection, setActiveSection] = useState(null)
  const activeSectionRef = useRef(null)
  const lastTocIndexRef = useRef(-1)
  const tocIds = useMemo(
    () => (toc || []).map(item => uuidToId(item.id)),
    [toc]
  )

  const actionSectionScrollSpy = useMemo(
    () =>
      throttle(() => {
        const sections = document.getElementsByClassName('notion-h')
        let prevBBox = null
        let currentSectionId = activeSectionRef.current
        for (let i = 0; i < sections.length; ++i) {
          const section = sections[i]
          if (!section || !(section instanceof Element)) continue
          if (!currentSectionId) {
            currentSectionId = section.getAttribute('data-id')
          }
          const bbox = section.getBoundingClientRect()
          const prevHeight = prevBBox ? bbox.top - prevBBox.bottom : 0
          const offset = Math.max(150, prevHeight / 4)
          // GetBoundingClientRect returns values relative to viewport
          if (bbox.top - offset < 0) {
            currentSectionId = section.getAttribute('data-id')
            prevBBox = bbox
            continue
          }
          // No need to continue loop, if last element has been detected
          break
        }
        if (activeSectionRef.current !== currentSectionId) {
          activeSectionRef.current = currentSectionId
          setActiveSection(currentSectionId)
        }

        const index = Math.max(0, tocIds.indexOf(currentSectionId))
        if (lastTocIndexRef.current !== index) {
          lastTocIndexRef.current = index
          tRef?.current?.scrollTo({ top: 28 * index, behavior: 'auto' })
        }
      }, 200),
    [tocIds]
  )

  useEffect(() => {
    actionSectionScrollSpy()
    window.addEventListener('scroll', actionSectionScrollSpy, { passive: true })
    return () => {
      window.removeEventListener('scroll', actionSectionScrollSpy)
      actionSectionScrollSpy.cancel?.()
    }
  }, [actionSectionScrollSpy])

  // 无目录就直接返回空
  if (!toc || toc.length < 1) {
    return <></>
  }

  return (
    <div className='px-3 py-1 dark:text-white text-black'>
      <div className='w-full'>
        <i className='mr-1 fas fa-stream' />
        {locale.COMMON.TABLE_OF_CONTENTS}
      </div>
      <div
        className='overflow-y-auto max-h-36 lg:max-h-96 overscroll-none scroll-hidden'
        ref={tRef}>
        <nav className='h-full'>
          {toc?.map(tocItem => {
            const id = uuidToId(tocItem.id)
            return (
              <a
                key={id}
                href={`#${id}`}
                className={`notion-table-of-contents-item duration-300 transform dark:text-gray-200
            notion-table-of-contents-item-indent-level-${tocItem.indentLevel} catalog-item `}>
                <span
                  style={{
                    display: 'inline-block',
                    marginLeft: tocItem.indentLevel * 16
                  }}
                  className={`truncate ${activeSection === id ? 'font-bold text-indigo-600' : ''}`}>
                  {tocItem.text}
                </span>
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default Catalog
