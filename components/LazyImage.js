import { siteConfig } from '@/lib/config'
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

const lazyImageTargets = new Map()
let sharedImageObserver

const releaseLazyImage = image => {
  lazyImageTargets.delete(image)
  sharedImageObserver?.unobserve(image)

  if (lazyImageTargets.size === 0) {
    sharedImageObserver?.disconnect()
    sharedImageObserver = undefined
  }
}

const getSharedImageObserver = () => {
  if (typeof window === 'undefined' || !window.IntersectionObserver) {
    return null
  }

  if (!sharedImageObserver) {
    sharedImageObserver = new window.IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            return
          }

          const loadImage = lazyImageTargets.get(entry.target)
          if (loadImage) {
            loadImage()
            lazyImageTargets.delete(entry.target)
            sharedImageObserver?.unobserve(entry.target)

            if (lazyImageTargets.size === 0) {
              sharedImageObserver?.disconnect()
              sharedImageObserver = undefined
            }
          }
        })
      },
      {
        rootMargin: siteConfig('LAZY_LOAD_THRESHOLD', '200px'),
        threshold: 0.1
      }
    )
  }

  return sharedImageObserver
}

/**
 * 图片懒加载
 * @param {*} param0
 * @returns
 */
export default function LazyImage({
  priority,
  id,
  src,
  alt,
  placeholderSrc,
  className,
  width,
  height,
  title,
  onLoad,
  onClick,
  style
}) {
  const maxWidth = siteConfig('IMAGE_COMPRESS_WIDTH')
  const defaultPlaceholderSrc = siteConfig('IMG_LAZY_LOAD_PLACEHOLDER')
  const fallbackSrc = placeholderSrc || defaultPlaceholderSrc
  const imageRef = useRef(null)
  const loadedRef = useRef(false)
  // 图片加载完就把骨架动画摘掉。之前只在 onLoad 里改 DOM class，
  // 组件一旦重新渲染，className 又把 lazy-image-placeholder 写回去，
  // 结果加载完的图还在跑 1 秒循环的流光动画，几十张一起跑白白占渲染。
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(
    placeholderSrc || defaultPlaceholderSrc
  )

  const adjustedImageSrc = adjustImgSize(src, maxWidth) || defaultPlaceholderSrc

  useEffect(() => {
    loadedRef.current = false
    setImageLoaded(false)

    if (!src) {
      return undefined
    }

    if (priority) {
      setCurrentSrc(adjustedImageSrc)
      return undefined
    }

    const image = imageRef.current
    const observer = getSharedImageObserver()

    if (!image || !observer) {
      setCurrentSrc(adjustedImageSrc)
      return undefined
    }

    const loadImage = () => {
      setCurrentSrc(adjustedImageSrc)
    }

    lazyImageTargets.set(image, loadImage)
    observer.observe(image)

    return () => {
      releaseLazyImage(image)
    }
  }, [adjustedImageSrc, priority, src])

  // 图片可能在 React 接管之前就已经加载完（SSR 输出的 img 标签、或浏览器缓存命中），
  // 这种情况下 onLoad 不会再触发，骨架底色会一直留着，这里补一次检查。
  useEffect(() => {
    const image = imageRef.current
    if (!image || imageLoaded) {
      return undefined
    }

    const syncIfLoaded = () => {
      if (image.complete && image.naturalWidth > 0) {
        setImageLoaded(true)
        image.classList.remove('lazy-image-placeholder')
      }
    }

    syncIfLoaded()
    const timer = setTimeout(syncIfLoaded, 300)
    return () => clearTimeout(timer)
  }, [currentSrc, imageLoaded])

  const notifyLoaded = () => {
    if (loadedRef.current) {
      return
    }

    loadedRef.current = true
    if (typeof onLoad === 'function') {
      onLoad()
    }
  }

  const handleImageLoaded = event => {
    notifyLoaded()
    setImageLoaded(true)

    // 不比较 src：src 被浏览器转成绝对地址后和 adjustedImageSrc 对不上，
    // 原来的比较会让 class 永远摘不掉。
    event.currentTarget?.classList?.remove('lazy-image-placeholder')
  }

  const handleImageError = event => {
    const image = event.currentTarget
    if (!image) {
      return
    }

    if (image.src !== fallbackSrc && fallbackSrc) {
      setCurrentSrc(fallbackSrc)
    } else {
      setCurrentSrc(defaultPlaceholderSrc)
    }

    image.classList.remove('lazy-image-placeholder')
  }

  // 动态添加width、height和className属性，仅在它们为有效值时添加
  const imgProps = {
    ref: imageRef,
    src: currentSrc,
    'data-src': src,
    onLoad: handleImageLoaded,
    onError: handleImageError,
    className: `${className || ''}${imageLoaded ? '' : ' lazy-image-placeholder'}`,
    style,
    width: width || 'auto',
    height: height || 'auto',
    onClick,
    // 共享 IntersectionObserver，同时保留原生懒加载作为浏览器级兜底。
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    ...(siteConfig('WEBP_SUPPORT') && { 'data-webp': true }),
    ...(siteConfig('AVIF_SUPPORT') && { 'data-avif': true })
  }

  if (id) imgProps.id = id
  if (title) imgProps.title = title

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...imgProps} alt={alt || ''} />
      {/* 预加载 */}
      {priority && src && (
        <Head>
          <link rel='preload' as='image' href={adjustedImageSrc} />
        </Head>
      )}
    </>
  )
}

/**
 * 根据窗口尺寸决定压缩图片宽度
 * @param {*} src
 * @param {*} maxWidth
 * @returns
 */
const adjustImgSize = (src, maxWidth) => {
  if (!src) {
    return null
  }

  const screenWidth =
    (typeof window !== 'undefined' && window?.innerWidth) || maxWidth

  // 屏幕尺寸大于默认图片尺寸，没必要再压缩
  if (screenWidth > maxWidth) {
    return src
  }

  // 正则表达式，用于匹配 URL 中的 width 参数
  const widthRegex = /width=\d+/
  // 正则表达式，用于匹配 URL 中的 w 参数
  const wRegex = /w=\d+/

  // 使用正则表达式替换 width/w 参数
  return src
    .replace(widthRegex, `width=${screenWidth}`)
    .replace(wRegex, `w=${screenWidth}`)
}
