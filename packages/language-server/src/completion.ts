/**
 * Completion provider (first-phase contexts).
 */

import { parse, resolveScope, lookupModuleScope } from '@agile-sofl/parser'
import type { ModuleNode, ProcessNode, ProgramNode } from '@agile-sofl/parser'
import type { SymbolEntry } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, InsertTextFormat, type CompletionItem, type Position } from 'vscode-languageserver/node.js'
import { bindingNamesAtOffset } from './bindings.js'
import { IDENT, IDENT_PARTIAL } from './ident.js'
const BASIC_TYPES = ['nat', 'int', 'bool', 'char', 'string', 'real', 'given']

const PROCESS_KEYWORDS = ['pre', 'post', 'FSF', 'ext', 'decom', 'comment', 'end_process']

const FSF_KEYWORDS = ['others', '&&', '||']

const GUI_BLOCK_KEYWORDS = ['gui', 'screen', 'end_screen', 'end_gui']
const GUI_WIDGET_KEYWORDS = ['label', 'button', 'text-input', 'navigation', 'triggers']

function inGuiBlock(program: ProgramNode, offset: number): boolean {
  const mod = moduleAtOffset(program, offset)
  if (!mod?.gui) return false
  return offset >= mod.gui.span.start && offset <= mod.gui.span.end
}

function linePrefix(document: TextDocument, position: Position): string {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: position
  })
  return line
}

function moduleAtOffset(program: ProgramNode, offset: number): ModuleNode | null {
  let best: ModuleNode | null = null
  let bestStart = -1
  for (const mod of program.modules) {
    const { span } = mod
    if (span.end <= span.start) continue
    if (offset >= span.start && span.start >= bestStart) {
      best = mod
      bestStart = span.start
    }
  }
  return best
}

function processAtOffset(mod: ModuleNode, offset: number): ProcessNode | null {
  let best: ProcessNode | null = null
  let bestStart = -1
  for (const proc of mod.processes) {
    if (offset >= proc.span.start && proc.span.start >= bestStart) {
      best = proc
      bestStart = proc.span.start
    }
  }
  return best
}

function collectScopeSymbols(
  program: ProgramNode,
  scopeResult: ReturnType<typeof resolveScope>,
  offset: number
): SymbolEntry[] {
  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return []

  const scope = lookupModuleScope(scopeResult, currentMod.name)
  if (!scope) return []

  const symbols = new Map<string, SymbolEntry>()
  for (const sym of scope.symbols.values()) {
    symbols.set(sym.name, sym)
  }
  if (scope.parent) {
    for (const sym of scope.parent.symbols.values()) {
      if (sym.kind === 'type' || sym.kind === 'var' || sym.kind === 'const' || sym.kind === 'function') {
        symbols.set(sym.name, sym)
      }
    }
  }

  const proc = processAtOffset(currentMod, offset)
  if (proc) {
    for (const group of [...proc.inputs, ...proc.outputs]) {
      for (const name of group.names) {
        symbols.set(name, { kind: 'var', name, moduleName: currentMod.name, span: group.span })
      }
    }
    for (const ext of proc.body?.ext ?? []) {
      symbols.set(ext.name, { kind: 'var', name: ext.name, moduleName: currentMod.name, span: ext.span })
    }
  }

  return [...symbols.values()]
}

function symbolToCompletionKind(kind: SymbolEntry['kind']): CompletionItemKind {
  switch (kind) {
    case 'function':
      return CompletionItemKind.Function
    case 'type':
      return CompletionItemKind.TypeParameter
    case 'process':
      return CompletionItemKind.Method
    case 'const':
      return CompletionItemKind.Constant
    default:
      return CompletionItemKind.Variable
  }
}
function collectTypeNames(
  program: ProgramNode,
  scopeResult: ReturnType<typeof resolveScope>,
  offset: number
): string[] {
  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return []

  const scope = lookupModuleScope(scopeResult, currentMod.name)
  const names = new Set<string>(BASIC_TYPES)
  if (scope) {
    for (const sym of scope.symbols.values()) {
      if (sym.kind === 'type') names.add(sym.name)
    }
    if (scope.parent) {
      for (const sym of scope.parent.symbols.values()) {
        if (sym.kind === 'type') names.add(sym.name)
      }
    }
  }
  return [...names]
}

function quantifierBindingsAtOffset(program: ProgramNode, offset: number): string[] {
  return bindingNamesAtOffset(program, offset)
}

function inBindingCompletionContext(prefix: string): boolean {
  return prefix.includes('|') || /\{[^\}]*$/.test(prefix) || /\[[^\]]*$/.test(prefix)
}
export function getCompletions(document: TextDocument, position: Position): CompletionItem[] {
  const prefix = linePrefix(document, position)
  const trimmed = prefix.trimStart()
  const source = document.getText()
  const offset = document.offsetAt(position)
  const { ast } = parse(source)
  const scopeResult = ast && ast.type === 'program' ? resolveScope(ast) : null

  if (ast?.type === 'program') {
    const bindings = quantifierBindingsAtOffset(ast, offset)
    if (bindings.length && inBindingCompletionContext(prefix)) {
      const partial = prefix.match(new RegExp(`(${IDENT.source})\\s*$`, 'u'))?.[1] ?? ''
      return bindings
        .filter((name) => name.startsWith(partial))
        .map((name) => ({ label: name, kind: CompletionItemKind.Variable }))
    }
  }

  if (new RegExp(`:\\s*${IDENT_PARTIAL.source}$`, 'u').test(prefix) && ast?.type === 'program' && scopeResult) {
    const partial = prefix.match(new RegExp(`:\\s*(${IDENT_PARTIAL.source})$`, 'u'))?.[1] ?? ''
    const scopeTypes = collectTypeNames(ast, scopeResult, offset)
    return scopeTypes
      .filter((name) => name.startsWith(partial))
      .map((name) => ({ label: name, kind: CompletionItemKind.TypeParameter }))
  }

  if (/^\s*(process|function)\b/.test(trimmed) === false && /^\s*(FSF|pre|post|ext|decom|comment)\b/.test(trimmed)) {
    return PROCESS_KEYWORDS.filter((k) => k.startsWith(trimmed.split(/\s+/).pop() ?? '')).map((k) => ({
      label: k,
      kind: CompletionItemKind.Keyword
    }))
  }

  if (/^\s*(module|system)\b/.test(trimmed) && trimmed.split(/\s+/).length <= 2) {
    return [
      {
        label: 'module SYSTEM_Name',
        kind: CompletionItemKind.Snippet,
        insertText: 'module SYSTEM_${1:Name};\n    ${0}\nend_module',
        insertTextFormat: InsertTextFormat.Snippet
      },
      {
        label: 'system SYSTEM_Name',
        kind: CompletionItemKind.Snippet,
        insertText: 'system SYSTEM_${1:Name};\n    ${0}\nend_module',
        insertTextFormat: InsertTextFormat.Snippet
      }
    ]
  }

  if (/^\s*process\b/.test(trimmed) && trimmed.split(/\s+/).length <= 2) {
    return [
      {
        label: 'process Name(...) pre/post',
        kind: CompletionItemKind.Snippet,
        insertText:
          'process ${1:Name}(${2:x: nat}) ${3:result: nat}\n    pre\n        ${4:true}\n    post\n        ${5:true}\nend_process',
        insertTextFormat: InsertTextFormat.Snippet
      }
    ]
  }

  if (/^\s*FSF\s*:\s*$/.test(trimmed) || (/^\s*others\b/.test(trimmed) && !/&&/.test(trimmed.replace(/^\s*others\s*/, '')))) {
    const items: CompletionItem[] = FSF_KEYWORDS.map((k) => ({ label: k, kind: CompletionItemKind.Keyword }))
    items.push({
      label: 'FSF others branch',
      kind: CompletionItemKind.Snippet,
      insertText: 'others && ${1:true}',
      insertTextFormat: InsertTextFormat.Snippet
    })
    return items
  }

  if (new RegExp(`module\\s+${IDENT.source}\\s*/\\s*${IDENT_PARTIAL.source}$`, 'u').test(prefix)) {
    if (ast?.type === 'program') {
      return ast.modules.map((m) => ({ label: m.name, kind: CompletionItemKind.Module }))
    }
  }

  if (ast?.type === 'program') {
    const partial = trimmed.match(new RegExp(`(${IDENT.source}|[A-Za-z_-]*)$`, 'u'))?.[1] ?? ''
    if (inGuiBlock(ast, offset)) {
      if (new RegExp(`triggers\\s+${IDENT_PARTIAL.source}$`, 'u').test(trimmed)) {
        const mod = moduleAtOffset(ast, offset)
        if (mod) {
          return mod.processes
            .map((p) => ({ label: p.name, kind: CompletionItemKind.Method }))
            .filter((item) => item.label.startsWith(partial))
        }
      }
      const keywords = [...GUI_WIDGET_KEYWORDS, ...GUI_BLOCK_KEYWORDS]
      return keywords
        .filter((k) => k.startsWith(partial))
        .map((k) => ({ label: k, kind: CompletionItemKind.Keyword }))
    }
    const mod = moduleAtOffset(ast, offset)
    if (mod && !mod.gui && /^\s*[a-z-]*$/i.test(trimmed) && 'gui'.startsWith(trimmed.trim())) {
      return [
        {
          label: 'gui',
          kind: CompletionItemKind.Snippet,
          insertText:
            'gui ${1:AppGui};\n  screen ${2:Home} triggers ${3:Mod.Proc};\nend_gui;',
          insertTextFormat: InsertTextFormat.Snippet
        }
      ]
    }
  }

  if (ast?.type === 'program' && scopeResult) {
    const scopeSymbols = collectScopeSymbols(ast, scopeResult, offset)
    return scopeSymbols.map((sym) => ({
      label: sym.name,
      kind: symbolToCompletionKind(sym.kind)
    }))
  }
  return []
}
