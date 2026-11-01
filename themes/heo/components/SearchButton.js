import { useGlobal } from '@/lib/global'
import dynamic from 'next/dynamic'
import { useRef } from 'react'

const PagefindSearchModal = dynamic(
  () => import('@/components/PagefindSearchModal'),
  { ssr: false }
)

/**
 * 搜索按钮
 * @returns
 */
export default function SearchButton(props) {
  const { locale } = useGlobal()
  const searchModal = useRef(null)

  return (
    <>
      <div
        onClick={() => searchModal.current?.openSearch()}
        title={locale.NAV.SEARCH}
        alt={locale.NAV.SEARCH}
        className='cursor-pointer hover:bg-black hover:bg-opacity-10 rounded-full w-10 h-10 flex justify-center items-center duration-200 transition-all'>
        <i
          title={locale.NAV.SEARCH}
          className='fa-solid fa-magnifying-glass'
        />
      </div>
      <PagefindSearchModal cRef={searchModal} {...props} />
    </>
  )
}
