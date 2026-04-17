import subscribeToMailchimpApi from '@/lib/plugins/mailchimp'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 鎺ュ彈閭欢璁㈤槄
 * @param {*} req
 * @param {*} res
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res
      .status(405)
      .json({ status: 'error', message: 'Method not allowed' })
  }

  const { email, firstName, lastName, first_name, last_name } = req.body || {}

  if (!EMAIL_PATTERN.test(email || '')) {
    return res.status(400).json({
      status: 'error',
      message: 'A valid email address is required'
    })
  }

  try {
    const response = await subscribeToMailchimpApi({
      email,
      first_name: firstName || first_name,
      last_name: lastName || last_name
    })

    if (!response?.ok) {
      const errorPayload = response?.json ? await response.json() : null
      return res.status(response?.status || 400).json({
        status: 'error',
        message: errorPayload?.detail || 'Subscription failed!'
      })
    }

    return res
      .status(200)
      .json({ status: 'success', message: 'Subscription successful!' })
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Subscription failed!'
    })
  }
}
