import type { GuiBlockNode, GuiScreenNode, GuiWidgetNode, ProgramNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import type { Span } from '../ast/span.js'

const WIDGET_KINDS = new Set(['label', 'button', 'text-input', 'navigation'])

function spanAt(source: string, start: number, end: number): Span {
  const before = source.slice(0, start)
  const line = before.split(/\r?\n/).length
  const lastNl = before.lastIndexOf('\n')
  const column = start - (lastNl >= 0 ? lastNl + 1 : 0) + 1
  return { start, end, line, column }
}

function parseStringLiteral(raw: string): string {
  const m = raw.match(/^"((?:\\.|[^"\\])*)"$/)
  if (m) return m[1]!.replace(/\\"/g, '"')
  return raw
}

export function parseGuiBlock(source: string, moduleStart: number, moduleEnd: number): {
  gui: GuiBlockNode | null
  diagnostics: Diagnostic[]
} {
  const slice = source.slice(moduleStart, moduleEnd)
  const match = /\bgui\s+([A-Za-z_]\w*)\s*;/i.exec(slice)
  if (!match) return { gui: null, diagnostics: [] }

  const blockStart = moduleStart + match.index!
  const afterHeader = blockStart + match[0].length
  const endMatch = /\bend_gui\s*;/i.exec(slice.slice(match.index! + match[0].length))
  const diagnostics: Diagnostic[] = []
  if (!endMatch) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.GUI_UNCLOSED_BLOCK,
        'GUI block missing end_gui;',
        'error',
        spanAt(source, blockStart, blockStart + match[0].length)
      )
    )
    return { gui: null, diagnostics }
  }

  const body = slice.slice(match.index! + match[0].length, match.index! + match[0].length + endMatch.index!)
  const blockEnd = afterHeader + endMatch.index! + endMatch[0].length
  const screens: GuiScreenNode[] = []
  const screenRe = /\bscreen\s+([A-Za-z_]\w*)\s*;/gi
  let screenMatch: RegExpExecArray | null

  while ((screenMatch = screenRe.exec(body)) !== null) {
    const screenName = screenMatch[1]!
    const screenBodyStart = screenMatch.index + screenMatch[0].length
    const endScreen = /\bend_screen\s*;/i.exec(body.slice(screenBodyStart))
    if (!endScreen) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.GUI_UNCLOSED_SCREEN,
          `Screen '${screenName}' missing end_screen;`,
          'error',
          spanAt(source, blockStart + match.index! + screenMatch.index, blockStart + match.index! + screenMatch.index + screenMatch[0].length)
        )
      )
      continue
    }
    const screenBody = body.slice(screenBodyStart, screenBodyStart + endScreen.index!)
    const widgets: GuiWidgetNode[] = []
    const widgetRe =
      /\b(label|button|text-input|navigation)\s+([A-Za-z_]\w*)\s+"((?:\\.|[^"\\])*)"(?:\s+triggers\s+([A-Za-z_]\w*))?\s*;/gi
    let wMatch: RegExpExecArray | null
    while ((wMatch = widgetRe.exec(screenBody)) !== null) {
      const kind = wMatch[1]!.toLowerCase() as GuiWidgetNode['kind']
      if (!WIDGET_KINDS.has(kind)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.GUI_UNKNOWN_WIDGET,
            `Unknown GUI widget kind '${wMatch[1]}'`,
            'error',
            spanAt(source, blockStart, blockStart + 1)
          )
        )
        continue
      }
      widgets.push({
        type: 'gui_widget',
        kind,
        name: wMatch[2]!,
        text: parseStringLiteral(`"${wMatch[3]!}"`),
        triggersProcess: wMatch[4],
        span: spanAt(source, blockStart, blockStart + 1)
      })
    }
    screens.push({
      type: 'gui_screen',
      name: screenName,
      widgets,
      span: spanAt(source, blockStart + match.index! + screenMatch.index, blockStart + match.index! + screenBodyStart + endScreen.index! + endScreen[0].length)
    })
  }

  return {
    gui: {
      type: 'gui_block',
      name: match[1]!,
      screens,
      span: spanAt(source, blockStart, blockEnd)
    },
    diagnostics
  }
}

export function removeGuiBlocksForParse(source: string): string {
  return source.replace(/\bgui\s+[A-Za-z_]\w*\s*;[\s\S]*?\bend_gui\s*;/gi, '')
}

export function attachGuiBlocksFromOriginal(program: ProgramNode, originalSource: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  let searchFrom = 0
  for (const mod of program.modules) {
    const header = mod.isSystem ? `module SYSTEM_${mod.name}` : `module ${mod.name}`
    const idx = originalSource.indexOf(header, searchFrom)
    if (idx < 0) continue
    const endIdx = originalSource.indexOf('end_module', idx)
    if (endIdx < 0) continue
    const end = endIdx + 'end_module'.length
    const local = parseGuiBlock(originalSource, idx, end)
    diagnostics.push(...local.diagnostics)
    if (local.gui) mod.gui = local.gui
    searchFrom = end
  }
  return diagnostics
}

export function attachGuiBlocks(program: ProgramNode, source: string): Diagnostic[] {
  return attachGuiBlocksFromOriginal(program, source)
}

export function validateGuiTriggers(program: ProgramNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const mod of program.modules) {
    if (!mod.gui) continue
    const processNames = new Set(mod.processes.map((p) => p.name))
    for (const screen of mod.gui.screens) {
      for (const widget of screen.widgets) {
        if (widget.triggersProcess && !processNames.has(widget.triggersProcess)) {
          diagnostics.push(
            createDiagnostic(
              DiagnosticCodes.GUI_UNKNOWN_TRIGGER,
              `GUI widget '${widget.name}' triggers unknown process '${widget.triggersProcess}'`,
              'warning',
              widget.span
            )
          )
        }
      }
    }
  }
  return diagnostics
}

export function attachAndValidateGui(program: ProgramNode, source: string): Diagnostic[] {
  return [...attachGuiBlocks(program, source), ...validateGuiTriggers(program)]
}
