import type { GuiDocumentModel } from '../model.js'

export type GuiCoverageItem = {
  aspecId: string
  kind: 'gui-screen' | 'gui-widget'
  name: string
  status: 'covered' | 'partial' | 'missing' | 'stale'
  detail?: string
}

export type GuiTraceLink = {
  aspecId: string
  kind: 'gui-screen' | 'gui-widget'
  asflSymbol?: string
  status: 'covered' | 'partial' | 'missing' | 'stale'
}

export function buildGuiTraceLinks(guiModel: GuiDocumentModel): GuiTraceLink[] {
  const links: GuiTraceLink[] = []
  for (const screen of guiModel.screens) {
    links.push({
      aspecId: screen.id,
      kind: 'gui-screen',
      asflSymbol: screen.triggersProcess,
      status: screen.triggersProcess ? 'partial' : 'missing'
    })
    for (const w of screen.widgets ?? []) {
      links.push({
        aspecId: w.id,
        kind: 'gui-widget',
        status: w.binds?.param || w.binds?.variable ? 'partial' : 'missing'
      })
    }
  }
  return links
}

export function extendCoverageWithGui(
  guiModel: GuiDocumentModel,
  processCovered: Set<string>
): GuiCoverageItem[] {
  const extra: GuiCoverageItem[] = []
  for (const screen of guiModel.screens) {
    let status: GuiCoverageItem['status'] = 'missing'
    if (screen.triggersProcess && processCovered.has(screen.triggersProcess)) {
      status = 'covered'
    } else if (screen.triggersProcess) {
      status = 'partial'
    } else if (screen.description?.trim() || (screen.widgets?.length ?? 0) > 0) {
      status = 'partial'
    }
    extra.push({
      aspecId: screen.id,
      kind: 'gui-screen',
      name: screen.title ?? screen.name,
      status
    })
  }
  return extra
}
