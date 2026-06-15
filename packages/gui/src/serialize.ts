import { stringify } from 'yaml'
import type { GuiDocument, GuiSection } from './model.js'

export function serializeGuiSpec(document: GuiDocument): string {
  return stringify(document, { lineWidth: 0 })
}

export function formatGuiSpec(document: GuiDocument): string {
  return serializeGuiSpec(document)
}

export function guiSectionToYaml(gui: GuiSection): string {
  return stringify({ gui }, { lineWidth: 0 })
}
