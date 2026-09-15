import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'
import { findModuleRange } from './moduleSourceRange.js'

function escapeString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function findModule(ast: ProgramNode, moduleName: string): ModuleNode | undefined {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function screenBlock(screenName: string, body?: string): string {
  const inner = body?.trim() ?? ''
  if (!inner) return `  screen ${screenName};`
  if (
    !inner.includes('\n') &&
    !inner.includes('"') &&
    !/^(label|button|text-input|navigation)\b/i.test(inner)
  ) {
    return `  screen ${screenName} triggers ${inner};`
  }
  return `screen ${screenName};\n${inner}\n  end_screen;`
}

function guiInsertPoint(source: string, moduleName: string, mod?: ModuleNode): number {
  const range = findModuleRange(source, moduleName)
  if (range) {
    const body = source.slice(range.bodyStart, range.endModule)
    const proc = /\bprocess\b/i.exec(body)
    if (proc) return range.bodyStart + proc.index
    return range.endModule
  }
  if (!mod) return source.length
  if (mod.processes[0]) return mod.processes[0].span.start
  if (mod.functions[0]) return mod.functions[0].span.start
  const endModule = source.lastIndexOf('end_module', mod.span.end)
  return endModule >= 0 ? endModule : mod.span.end
}

export function addGuiScreen(
  source: string,
  moduleName: string,
  screenName: string,
  body?: string
): string | null {
  const range = findModuleRange(source, moduleName)
  const { ast } = parse(source)
  const mod = ast?.type === 'program' ? findModule(ast, moduleName) : undefined
  if (!range && !mod) return null
  const block = screenBlock(screenName, body)
  const guiSpan = mod?.gui
  const guiSliceStart = range
    ? source.slice(range.bodyStart, range.endModule).toLowerCase().lastIndexOf('end_gui')
    : -1
  if (guiSpan) {
    const slice = source.slice(guiSpan.span.start, guiSpan.span.end)
    const endGui = slice.toLowerCase().lastIndexOf('end_gui')
    if (endGui < 0) return null
    const at = guiSpan.span.start + endGui
    return source.slice(0, at) + `${block}\n` + source.slice(at)
  }
  if (range && guiSliceStart >= 0) {
    const at = range.bodyStart + guiSliceStart
    return source.slice(0, at) + `${block}\n` + source.slice(at)
  }
  const guiName = `${(mod?.name ?? range?.name ?? moduleName)}_GUI`
  const guiBlock = `gui ${guiName};\n  ${block}\nend_gui;`
  const at = guiInsertPoint(source, moduleName, mod)
  return source.slice(0, at) + `${guiBlock}\n` + source.slice(at)
}

export function patchGuiWidgetText(
  source: string,
  program: ProgramNode,
  moduleName: string,
  screenName: string,
  widgetName: string,
  newText: string
): string | null {
  const mod = findModule(program, moduleName)
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
