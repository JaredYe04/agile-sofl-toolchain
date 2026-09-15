import type { GuiDocument, GuiSection } from './model.js'
import { parseGuiSpec } from './parse.js'

function ident(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `S_${cleaned}`
}

export function buildSlimGuiBlock(gui: GuiSection): string {
  const app = ident(gui.app.name || 'App')
  const lines = [`gui ${app};`]
  for (const screen of gui.screens) {
    const name = ident(screen.name || screen.id)
    const proc = screen.triggersProcess?.trim()
    if (proc) lines.push(`  screen ${name} triggers ${proc};`)
    else lines.push(`  screen ${name};`)
  }
  lines.push('end_gui;')
  return lines.join('\n')
}

export function buildSlimGuiBlockFromHtml(source: string): string | null {
  const { document } = parseGuiSpec(source)
  if (!document?.gui.screens.length) return null
  return buildSlimGuiBlock(document.gui)
}

export function buildSlimGuiBlockFromDocument(document: GuiDocument): string {
  return buildSlimGuiBlock(document.gui)
}
