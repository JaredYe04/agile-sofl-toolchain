export type AccentId = 'blue' | 'green' | 'orange' | 'purple' | 'yellow' | 'red' | 'pink' | 'custom'
export type UiZoom = 'small' | 'normal' | 'large' | 'xlarge'

export const ACCENT_PRESETS: Record<Exclude<AccentId, 'custom'>, { light: string; dark: string }> = {
  blue: { light: '#2563eb', dark: '#60a5fa' },
  green: { light: '#0d9488', dark: '#2dd4bf' },
  orange: { light: '#ea580c', dark: '#fb923c' },
  purple: { light: '#7c3aed', dark: '#a78bfa' },
  yellow: { light: '#ca8a04', dark: '#facc15' },
  red: { light: '#dc2626', dark: '#f87171' },
  pink: { light: '#db2777', dark: '#f472b6' }
}

export const UI_ZOOM_FACTOR: Record<UiZoom, number> = {
  small: 0.9,
  normal: 1,
  large: 1.125,
  xlarge: 1.25
}

export function clampTransparency(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function normalizeHex(raw: string): string | null {
  const value = raw.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.toLowerCase()
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

export function resolveAccentHex(id: AccentId, customHex: string, dark: boolean): string {
  if (id === 'custom') return normalizeHex(customHex) ?? (dark ? ACCENT_PRESETS.blue.dark : ACCENT_PRESETS.blue.light)
  return ACCENT_PRESETS[id][dark ? 'dark' : 'light']
}

/** Lower transparency => stronger accent (0 = vivid, 100 = muted). Default 50. */
export function accentMixPercent(transparency: number): number {
  const t = clampTransparency(transparency) / 100
  return Math.round(100 - t * 40)
}

export function accentTintPercent(transparency: number): number {
  const t = clampTransparency(transparency) / 100
  return Math.round((1 - t) * 16)
}

export function accentForeground(hex: string): string {
  const parsed = normalizeHex(hex)
  if (!parsed) return '#f8fafc'
  const n = Number.parseInt(parsed.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return y > 0.62 ? '#111827' : '#f8fafc'
}

export type AppearanceState = {
  dark: boolean
  accentId: AccentId
  customHex: string
  transparency: number
  zoom: UiZoom
}

export function applyAppearance(state: AppearanceState, root: HTMLElement = document.documentElement): void {
  const raw = resolveAccentHex(state.accentId, state.customHex, state.dark)
  const mix = accentMixPercent(state.transparency)
  const tint = accentTintPercent(state.transparency)
  root.style.setProperty('--accent-raw', raw)
  root.style.setProperty('--accent-mix', `${mix}%`)
  root.style.setProperty('--accent-tint', `${tint}%`)
  root.style.setProperty('--accent-tint-n', String(tint))
  root.style.setProperty('--accent-fg', accentForeground(raw))
  root.style.setProperty('--ui-zoom', String(UI_ZOOM_FACTOR[state.zoom] ?? 1))
  root.dataset.accent = state.accentId
  root.dataset.zoom = state.zoom
}
