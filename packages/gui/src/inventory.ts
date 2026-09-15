import type { GuiDocument, GuiDocumentModel } from './model.js'
import { parseGuiSpec } from './parse.js'
import { buildGuiModel } from './buildGuiModel.js'

export function formatGuiInventory(source: string, maxChars = 12000): string {
  const model = buildGuiModel(source)
  return formatGuiModelInventory(model, maxChars)
}

export function formatGuiModelInventory(model: GuiDocumentModel, maxChars = 12000): string {
  if (!model.screens.length) return '(empty GUI specification)'
  const lines: string[] = [`# GUI ${model.app.name || model.meta.title}`]
  for (const screen of model.screens) {
    lines.push(`## screen:${screen.name} [${screen.id}]`)
    if (screen.triggersProcess) lines.push(`- process: ${screen.triggersProcess}`)
    for (const w of screen.widgets ?? []) {
      const bind = w.binds
        ? Object.entries(w.binds)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
        : ''
      const extra = [w.process ? `process ${w.process}` : '', w.nav ? `nav ${w.nav}` : '', bind]
        .filter(Boolean)
        .join(', ')
      lines.push(`- ${w.id} (${w.kind}) ${w.label ?? ''}${extra ? ` — ${extra}` : ''}`)
    }
    lines.push('')
  }
  const text = lines.join('\n').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…(truncated)`
}

export function numberedGuiSource(source: string): string {
  return source.split(/\r?\n/).map((line, i) => `${String(i + 1).padStart(4, ' ')}| ${line}`).join('\n')
}

export function parseGuiDocument(source: string): GuiDocument | null {
  return parseGuiSpec(source).document
}
