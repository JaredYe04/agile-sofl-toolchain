import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { setLocale, type Locale } from '../i18n'
import { applyMonacoTheme } from '../monaco/setup'

export type ThemeMode = 'light' | 'dark' | 'system'

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyThemeClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
  applyMonacoTheme(isDark ? 'agile-sofl-dark' : 'agile-sofl-light')
}

const savedTheme = (localStorage.getItem('studio-theme') as ThemeMode | null) ?? 'system'

export const useAppStore = defineStore('app', () => {
  const theme = ref<ThemeMode>(savedTheme)
  const platform = ref('win32')
  const isMaximized = ref(false)

  function setTheme(mode: ThemeMode): void {
    theme.value = mode
    localStorage.setItem('studio-theme', mode)
    applyThemeClass(resolveDark(mode))
  }

  function setLanguage(locale: Locale): void {
    setLocale(locale)
  }

  async function init(): Promise<void> {
    platform.value = (await window.studio?.getPlatform()) ?? 'win32'
    isMaximized.value = (await window.studio?.isMaximized()) ?? false
    applyThemeClass(resolveDark(theme.value))

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') applyThemeClass(resolveDark('system'))
    })

    window.studio?.onMaximizedChanged((max) => {
      isMaximized.value = max
    })
  }

  watch(theme, (mode) => applyThemeClass(resolveDark(mode)))

  return { theme, platform, isMaximized, setTheme, setLanguage, init }
})
