import type { ProgramNode } from '@agile-sofl/parser'

function escapeString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function patchGuiWidgetText(
  source: string,
  program: ProgramNode,
  moduleName: string,
  screenName: string,
  widgetName: string,
  newText: string
): string | null {
  const mod = program.modules.find((m) => m.name === moduleName)
  const screen = mod?.gui?.screens.find((s) => s.name === screenName)
  const widget = screen?.widgets.find((w) => w.name === widgetName)
  if (!widget) return null
  const slice = source.slice(widget.span.start, widget.span.end)
  const match = slice.match(/"((?:\\.|[^"\\])*)"/)
  if (!match || match.index === undefined) return null
  const absStart = widget.span.start + match.index
  const absEnd = absStart + match[0].length
  return source.slice(0, absStart) + escapeString(newText) + source.slice(absEnd)
}
