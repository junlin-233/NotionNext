// lib/build/prefetch.js
import pLimit from 'p-limit'
import { fetchNotionPageBlocks } from '@/lib/db/notion/getPostBlocks'
import {
  getDataFromCache,
  setDataToCache

} from '@/lib/cache/cache_manager'


// lib/build/prefetch.js 中新增，或单独放 lib/build/buildUtils.js

// 预生成上限，防止文章量特别大时构建时间失控
const MAX_PREFETCH_PAGES = 200

/**
 * 获取需要预生成的页面
 *
 * 原来只挑 10 篇（最新 5 篇 + 默认排序前 5 篇），其余文章第一次被打开时要
 * 现场拉 Notion 数据再渲染，访客得等 5 秒以上才看到页面。
 * 这里改成全部已发布文章都在构建时生成好，首页/归档里点进去的任何一篇都是现成的。
 */
export function getPriorityPages(allPages) {
  const published = (allPages ?? []).filter(
    p => p.type === 'Post' && p.status === 'Published'
  )

  return published.slice(0, MAX_PREFETCH_PAGES)
}

/**
 * 预热所有页面的 block 数据
 * @param {*} allPages 页面列表
 * @param {*} concurrency 并发数
 */
export async function prefetchAllBlockMaps(allPages, concurrency = 8) {
  const limit = pLimit(concurrency)
  let hit = 0, fetched = 0, failed = 0

  console.log(`[Prefetch] 开始预热 ${allPages.length} 个页面 block`)
  const start = Date.now()

  await Promise.all(
    allPages.map(page =>
      limit(async () => {
        const cacheKey = `page_block_${page.id}`
        
        // 已有缓存跳过
        if (await getDataFromCache(cacheKey)) {
          hit++
          return
        }

        try {
          const block = await fetchNotionPageBlocks(page.id, 'prefetch')
          await setDataToCache(cacheKey, block, 1000 * 60 * 60 * 2) // 2小时
          fetched++
        } catch (e) {
          console.warn('[Prefetch Failed]', page.id, e.message)
          failed++
        }
      })
    )
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[Prefetch] 完成: 命中缓存=${hit} 新拉取=${fetched} 失败=${failed} 耗时=${elapsed}s`)
}