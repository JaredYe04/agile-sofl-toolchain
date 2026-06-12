import type { editor } from 'monaco-editor'
import palettes from '../../../../vscode/scripts/syntax-palettes.json'

type PaletteRule = {
  token: string
  foreground: string
  fontStyle?: string
}

type Palette = {
  editor: { background: string; foreground: string }
  field?: { background: string; foreground: string }
  rules: PaletteRule[]
}

function toMonacoRules(rules: PaletteRule[]): editor.ITokenThemeRule[] {
  return rules.map((r) => ({
    token: r.token,
    foreground: r.foreground,
    ...(r.fontStyle ? { fontStyle: r.fontStyle } : {})
  }))
}

function toMonacoTheme(name: 'vs' | 'vs-dark', palette: Palette): editor.IStandaloneThemeData {
  return {
    base: name,
    inherit: true,
    rules: toMonacoRules(palette.rules),
    colors: {
      'editor.background': palette.editor.background,
      'editor.foreground': palette.editor.foreground
    }
  }
}

function toFieldMonacoTheme(name: 'vs' | 'vs-dark', palette: Palette): editor.IStandaloneThemeData {
  const field = palette.field ?? palette.editor
  return {
    base: name,
    inherit: true,
    rules: toMonacoRules(palette.rules),
    colors: {
      'editor.background': field.background,
      'editor.foreground': field.foreground,
      'editor.lineHighlightBackground': '#00000000',
      'editorWidget.background': field.background
    }
  }
}

export const agileSoflLightTheme = toMonacoTheme('vs', palettes.light as Palette)
export const agileSoflDarkTheme = toMonacoTheme('vs-dark', palettes.dark as Palette)
export const agileSoflLightFieldTheme = toFieldMonacoTheme('vs', palettes.light as Palette)
export const agileSoflDarkFieldTheme = toFieldMonacoTheme('vs-dark', palettes.dark as Palette)

export function fieldThemeForDarkMode(isDark: boolean): editor.IStandaloneThemeData {
  return isDark ? agileSoflDarkFieldTheme : agileSoflLightFieldTheme
}

export function fieldThemeName(isDark: boolean): string {
  return isDark ? 'agile-sofl-dark-field' : 'agile-sofl-light-field'
}

/** LSP semantic token colors aligned with TextMate palette (Monaco uses theme rules for standard types). */
export function semanticTokenRulesForTheme(isDark: boolean): editor.ITokenThemeRule[] {
  const semantic = (isDark ? palettes.dark : palettes.light).semantic as Record<string, string>
  return Object.entries(semantic).map(([token, color]) => ({
    token,
    foreground: color.replace(/^#/, '')
  }))
}
