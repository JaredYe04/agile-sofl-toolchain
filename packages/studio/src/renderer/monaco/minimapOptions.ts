import type { editor } from 'monaco-editor'

export function buildMinimapOptions(enabled: boolean): editor.IEditorMinimapOptions {
  return {
    enabled,
    renderCharacters: false,
    showRegionSectionHeaders: false,
    showSlider: 'mouseover',
    scale: 1,
    size: 'proportional',
    maxColumn: 120
  }
}
