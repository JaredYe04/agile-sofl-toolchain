import { parseGuiSpec, parseGuiFromAspecYaml, buildSlimGuiBlock, type GuiSection } from '@agile-sofl/gui'

export function buildGuiBlockFromSection(gui: GuiSection): string {
  return buildSlimGuiBlock(gui)
}

export function resolveGuiSection(source: string, guiSource?: string): GuiSection | null {
  if (guiSource?.trim()) {
    const { document } = parseGuiSpec(guiSource)
    if (document?.gui.screens.length) return document.gui
    const { gui } = parseGuiFromAspecYaml(guiSource)
    return gui
  }
  return parseGuiFromAspecYaml(source).gui
}

export function buildGuiBlockForRefine(aspecSource: string, guiSource?: string): string | null {
  const section = resolveGuiSection(aspecSource, guiSource)
  if (!section?.screens?.length) return null
  return buildGuiBlockFromSection(section)
}
