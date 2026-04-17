function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function toBoolean(value, defaultValue = false) {
  if (!hasValue(value)) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false

  return defaultValue
}

function toNumber(value, defaultValue = 0) {
  if (!hasValue(value)) return defaultValue
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

function toStringArray(value, defaultValue = []) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }

  if (!hasValue(value)) return [...defaultValue]

  const normalized = String(value).trim()
  if (!normalized) return [...defaultValue]

  try {
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean)
    }
  } catch (error) {
    // Fallback to comma-separated parsing.
  }

  return normalized
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function toNumberArray(value, defaultValue = []) {
  if (Array.isArray(value)) {
    return value.map(item => toNumber(item, null)).filter(item => item !== null)
  }

  const normalized = toStringArray(value, [])
  if (normalized.length === 0) return [...defaultValue]

  return normalized
    .map(item => toNumber(item, null))
    .filter(item => item !== null)
}

module.exports = {
  hasValue,
  toBoolean,
  toNumber,
  toNumberArray,
  toStringArray
}
