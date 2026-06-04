import { initMonacoNlsFromStudioLocale } from './monaco/nls'
import { i18n } from './i18n'

const savedLocale = (localStorage.getItem('studio-locale') as 'en' | 'zh-CN' | null) ?? 'zh-CN'
initMonacoNlsFromStudioLocale(savedLocale)

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

createApp(App).use(createPinia()).use(i18n).mount('#app')
