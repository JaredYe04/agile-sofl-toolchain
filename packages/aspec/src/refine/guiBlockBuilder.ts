import { parseGuiSpec, parseGuiFromAspecYaml, type GuiSection, type GuiWidgetKind } from '@agile-sofl/gui'

const ASFL_WIDGET_KINDS = new Set(['label', 'button', 'text-input', 'navigation'])

function escapeAsflString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function mapWidgetKind(kind: GuiWidgetKind): string | null {
  if (ASFL_WIDGET_KINDS.has(kind)) return kind
  if (kind === 'section') return 'label'
  return null
}

function widgetText(widget: { label?: string; kind: GuiWidgetKind }): string {
  return (widget.label ?? widget.kind).slice(0, 120)
}

export function buildGuiBlockFromSection(gui: GuiSection): string {
  const lines: string[] = [`gui ${gui.app.name};`]
  for (const screen of gui.screens) {
    lines.push(`screen ${screen.name};`)
    for (const widget of screen.widgets ?? []) {
      const kind = mapWidgetKind(widget.kind)
      if (!kind) continue
      const safeName = /^[A-Za-z_]\w*$/.test(widget.id)
        ? widget.id
        : (widget.id.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, 'w') || 'w')
      let line = `    ${kind} ${safeName} ${escapeAsflString(widgetText(widget))}`
      const trigger = screen.triggersProcess ?? widget.action
      if (kind === 'button' && trigger) {
        line += ` triggers ${trigger}`
      }
      lines.push(`${line};`)
    }
    lines.push('end_screen;')
  }
  lines.push('end_gui;')
  return lines.join('\n')
}

export function resolveGuiSection(source: string, guiSource?: string): GuiSection | null {
  if (guiSource?.trim()) {
    if (guiSource.includes('guispecVersion')) {
      const { document } = parseGuiSpec(guiSource)
      return document?.gui ?? null
    }
    const { gui } = parseGuiFromAspecYaml(guiSource)
    return gui
  }
  const embedded = parseGuiFromAspecYaml(source)
  return embedded.gui
}

export function buildGuiBlockForRefine(aspecSource: string, guiSource?: string): string | null {
  const section = resolveGuiSection(aspecSource, guiSource)
  if (!section?.screens?.length) return null
  return buildGuiBlockFromSection(section)
}
