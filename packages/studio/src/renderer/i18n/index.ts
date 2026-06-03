import { createI18n } from 'vue-i18n'
import en from './en.json'
import zhCN from './zh-CN.json'

export type Locale = 'en' | 'zh-CN'

const saved = localStorage.getItem('studio-locale') as Locale | null

export const i18n = createI18n({
  legacy: false,
  locale: saved ?? 'zh-CN',
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN }
})

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  localStorage.setItem('studio-locale', locale)
}

export async function initLocaleFromSystem(): Promise<void> {
  if (saved) return
  const sys = await window.studio?.getLocale()
  if (sys?.startsWith('zh')) {
    setLocale('zh-CN')
  } else {
    setLocale('en')
  }
}
