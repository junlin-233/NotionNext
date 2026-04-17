import BLOG from '@/blog.config'
import { cleanCache } from '@/lib/cache/local_file_cache'

function getCacheApiSecret(req) {
  const authHeader = req.headers.authorization || ''
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''
  const headerToken = req.headers['x-cache-secret']

  if (Array.isArray(headerToken)) {
    return headerToken[0] || bearerToken
  }

  return headerToken || bearerToken
}

/**
 * 娓呯悊缂撳瓨
 * @param {*} req
 * @param {*} res
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    })
  }

  const expectedSecret = BLOG.CACHE_API_SECRET
  const receivedSecret = getCacheApiSecret(req)
  const shouldAuthorize = Boolean(expectedSecret) || process.env.NODE_ENV === 'production'

  if (shouldAuthorize) {
    if (!expectedSecret) {
      return res.status(403).json({
        status: 'error',
        message: 'Cache API is disabled in production without CACHE_API_SECRET'
      })
    }

    if (receivedSecret !== expectedSecret) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      })
    }
  }

  try {
    cleanCache()
    return res
      .status(200)
      .json({ status: 'success', message: 'Clean cache successful!' })
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Clean cache failed!'
    })
  }
}
