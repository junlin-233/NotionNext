import BLOG from '@/blog.config'

export const loadDarkModeFromLocalStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem('darkMode')
}

export const saveDarkModeToLocalStorage = newTheme => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem('darkMode', String(newTheme))
}

export function isPreferDark() {
  if (BLOG.APPEARANCE === 'dark') {
    return true
  }

  if (BLOG.APPEARANCE !== 'auto' || typeof window === 'undefined') {
    return false
  }

  const date = new Date()
  const prefersDarkMode = window.matchMedia?.(
    '(prefers-color-scheme: dark)'
  )?.matches
  const [darkTimeStart = 18, darkTimeEnd = 6] = BLOG.APPEARANCE_DARK_TIME || []

  return Boolean(
    prefersDarkMode ||
      date.getHours() >= darkTimeStart ||
      date.getHours() < darkTimeEnd
  )
}

export const initDarkMode = (updateDarkMode, defaultDarkMode) => {
  if (typeof document === 'undefined') {
    return
  }

  let newDarkMode = isPreferDark()
  const userDarkMode = loadDarkModeFromLocalStorage()

  if (userDarkMode !== null) {
    newDarkMode = userDarkMode === 'dark' || userDarkMode === 'true'
  }

  if (defaultDarkMode === 'dark' || defaultDarkMode === true) {
    newDarkMode = true
  }

  const queryMode = new URLSearchParams(window.location.search).get('mode')
  if (queryMode) {
    newDarkMode = queryMode === 'dark'
  }

  updateDarkMode(newDarkMode)

  const htmlElement = document.documentElement
  htmlElement.classList.toggle('dark', newDarkMode)
  htmlElement.classList.toggle('light', !newDarkMode)
}
