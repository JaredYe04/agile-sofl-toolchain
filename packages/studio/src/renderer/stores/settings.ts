import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  applyAppearance,
  clampTransparency,
  type AccentId,
  type UiZoom
} from '../lib/appearance'
import { useAppStore } from './app'
import { useWorkspaceStore } from './workspace'
import type { Locale } from '../i18n'

const ACCENT_IDS: AccentId[] = ['blue', 'green', 'orange', 'purple', 'yellow', 'red', 'pink', 'custom']
const ZOOMS: UiZoom[] = ['small', 'normal', 'large', 'xlarge']

function readAccentId(): AccentId {
  const raw = localStorage.getItem('studio-accent-id')
  return ACCENT_IDS.includes(raw as AccentId) ? (raw as AccentId) : 'blue'
}

function readZoom(): UiZoom {
  const raw = localStorage.getItem('studio-ui-zoom')
  return ZOOMS.includes(raw as UiZoom) ? (raw as UiZoom) : 'normal'
}

function readTransparency(): number {
  const raw = Number(localStorage.getItem('studio-accent-transparency'))
  return clampTransparency(Number.isFinite(raw) ? raw : 50)
}

export type InformalViewMode = 'document' | 'graphical'
export type HybridViewMode = 'code' | 'visual'

function readInformalDefault(): InformalViewMode {
  const raw = localStorage.getItem('studio-default-informal-view')
  return raw === 'graphical' ? 'graphical' : 'document'
}

function readHybridDefault(): HybridViewMode {
  const raw = localStorage.getItem('studio-default-hybrid-view')
  return raw === 'code' ? 'code' : 'visual'
}

export const useSettingsStore = defineStore('settings', () => {
  const open = ref(false)
  const accentId = ref<AccentId>(readAccentId())
  const customHex = ref(localStorage.getItem('studio-accent-custom') || '#2563eb')
  const transparency = ref(readTransparency())
  const zoom = ref<UiZoom>(readZoom())
  const defaultInformalView = ref<InformalViewMode>(readInformalDefault())
  const defaultHybridView = ref<HybridViewMode>(readHybridDefault())

  function persist(): void {
    localStorage.setItem('studio-accent-id', accentId.value)
    localStorage.setItem('studio-accent-custom', customHex.value)
    localStorage.setItem('studio-accent-transparency', String(transparency.value))
    localStorage.setItem('studio-ui-zoom', zoom.value)
    localStorage.setItem('studio-default-informal-view', defaultInformalView.value)
    localStorage.setItem('studio-default-hybrid-view', defaultHybridView.value)
  }

  function paint(): void {
    const app = useAppStore()
    applyAppearance({
      dark: app.isDark,
      accentId: accentId.value,
      customHex: customHex.value,
      transparency: transparency.value,
      zoom: zoom.value
    })
  }

  function setAccentId(id: AccentId): void {
    accentId.value = id
    persist()
    paint()
  }

  function setCustomHex(hex: string): void {
    customHex.value = hex
    persist()
    paint()
  }

  function setTransparency(value: number): void {
    transparency.value = clampTransparency(value)
    persist()
    paint()
  }

  function setZoom(value: UiZoom): void {
    zoom.value = value
    persist()
    paint()
  }

  function setDefaultInformalView(value: InformalViewMode): void {
    defaultInformalView.value = value
    persist()
    useWorkspaceStore().informalViewMode = value
  }

  function setDefaultHybridView(value: HybridViewMode): void {
    defaultHybridView.value = value
    persist()
    useWorkspaceStore().hybridMode = value
  }

  function setLanguage(locale: Locale): void {
    useAppStore().setLanguage(locale)
  }

  function show(): void {
    open.value = true
  }

  function hide(): void {
    open.value = false
  }

  function init(): void {
    paint()
    const app = useAppStore()
    watch(
      () => app.isDark,
      () => paint()
    )
  }

  if (typeof document !== 'undefined') {
    paint()
  }

  return {
    open,
    accentId,
    customHex,
    transparency,
    zoom,
    defaultInformalView,
    defaultHybridView,
    setAccentId,
    setCustomHex,
    setTransparency,
    setZoom,
    setDefaultInformalView,
    setDefaultHybridView,
    setLanguage,
    show,
    hide,
    init
  }
})
