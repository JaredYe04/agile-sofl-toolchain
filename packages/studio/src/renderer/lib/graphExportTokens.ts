/** Graph export theme tokens — values mirror packages/studio/src/renderer/styles/main.css */

export const GRAPH_EXPORT_THEME_VARS = [
  '--surface-base',
  '--surface-raised',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-subtle',
  '--accent',
  '--role-process',
  '--role-function'
] as const

export const LIGHT_GRAPH_EXPORT_TOKENS: Record<string, string> = {
  '--surface-base': '#f3f3f3',
  '--surface-raised': '#ffffff',
  '--text-primary': '#1e1e1e',
  '--text-secondary': '#616161',
  '--text-muted': '#8b8b8b',
  '--border-subtle': '#e5e5e5',
  '--accent': '#0078d4',
  '--role-process': '#0ea5e9',
  '--role-function': '#f97316'
}

export const DARK_GRAPH_EXPORT_TOKENS: Record<string, string> = {
  '--surface-base': '#1e1e1e',
  '--surface-raised': '#252526',
  '--text-primary': '#e8e8e8',
  '--text-secondary': '#b0b0b0',
  '--text-muted': '#8a8a8a',
  '--border-subtle': '#3c3c3c',
  '--accent': '#3794ff',
  '--role-process': '#38bdf8',
  '--role-function': '#fb923c'
}

export function graphThemeVars(theme: 'current' | 'light' | 'dark'): Record<string, string> {
  if (theme === 'light') return { ...LIGHT_GRAPH_EXPORT_TOKENS }
  if (theme === 'dark') return { ...DARK_GRAPH_EXPORT_TOKENS }
  const root = document.documentElement
  const out: Record<string, string> = {}
  for (const v of GRAPH_EXPORT_THEME_VARS) {
    out[v] = getComputedStyle(root).getPropertyValue(v).trim()
  }
  return out
}

export function graphExportStyleBlock(vars: Record<string, string>): string {
  const rootVars = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v.trim()};`)
    .join('\n')
  return `:root { ${rootVars} }
text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }`
}
