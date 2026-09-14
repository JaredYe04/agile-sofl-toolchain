import { parse, type ModuleNode, type ProgramNode } from '@agile-sofl/parser'

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

function defaultScreenBody(screenName: string): string {
  return `    label Title "${screenName}";`
}

function screenBlock(screenName: string, body?: string): string {
  const inner = body?.trim() || defaultScreenBody(screenName)
  return `screen ${screenName};\n${inner}\n  end_screen;`
}

function guiInsertPoint(source: string, mod: ModuleNode): number {
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
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return null
  const mod = findModule(ast, moduleName)
  if (!mod) return null
  const block = screenBlock(screenName, body)
  if (mod.gui) {
    const slice = source.slice(mod.gui.span.start, mod.gui.span.end)
    const endGui = slice.toLowerCase().lastIndexOf('end_gui')
    if (endGui < 0) return null
    const at = mod.gui.span.start + endGui
    return source.slice(0, at) + `${block}\n` + source.slice(at)
  }
  const guiName = `${mod.name}_GUI`
  const guiBlock = `gui ${guiName};\n  ${block}\nend_gui;`
  const at = guiInsertPoint(source, mod)
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
