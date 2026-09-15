import type { GuiDocument, GuiSection } from './model.js'
import { sanitizeHtml } from './html.js'

export function serializeGuiSpec(document: GuiDocument): string {
  return sanitizeHtml(document.html || '')
}

export function formatGuiSpec(document: GuiDocument): string {
  return serializeGuiSpec(document)
}

export function guiSectionToYaml(gui: GuiSection): string {
  return JSON.stringify({ gui }, null, 2)
}
