/**
 * Completion provider (first-phase contexts).
 */

import { parse, resolveScope, lookupModuleScope } from '@agile-sofl/parser'
import type { ModuleNode, ProcessNode, ProgramNode } from '@agile-sofl/parser'
import type { SymbolEntry } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, InsertTextFormat, type CompletionItem, type Position } from 'vscode-languageserver/node.js'
import { bindingNamesAtOffset } from './bindings.js'
const BASIC_TYPES = ['nat', 'int', 'bool', 'char', 'string', 'real', 'given']

const PROCESS_KEYWORDS = ['FSF', 'ext', 'decom', 'comment', 'end_process']

const FSF_KEYWORDS = ['others', '&&', '||']

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
    if (bindings.length && inBindingCompletionContext(prefix)) {      const partial = prefix.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/)?.[1] ?? ''
      return bindings
        .filter((name) => name.startsWith(partial))
        .map((name) => ({ label: name, kind: CompletionItemKind.Variable }))
    }
  }

  if (/:\s*[A-Za-z_]*$/.test(prefix) && ast?.type === 'program' && scopeResult) {
    const partial = prefix.match(/:\s*([A-Za-z_]*)$/)?.[1] ?? ''
    const scopeTypes = collectTypeNames(ast, scopeResult, offset)
    return scopeTypes
      .filter((name) => name.startsWith(partial))
      .map((name) => ({ label: name, kind: CompletionItemKind.TypeParameter }))
  }

  if (/^\s*(process|function)\b/.test(trimmed) === false && /^\s*(FSF|ext|decom|comment)\b/.test(trimmed)) {
    return PROCESS_KEYWORDS.filter((k) => k.startsWith(trimmed.split(/\s+/).pop() ?? '')).map((k) => ({
      label: k,
      kind: CompletionItemKind.Keyword
    }))
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

  if (/module\s+[A-Za-z_][A-Za-z0-9_]*\s*\/\s*[A-Za-z_]*$/.test(prefix)) {
    if (ast?.type === 'program') {
      return ast.modules.map((m) => ({ label: m.name, kind: CompletionItemKind.Module }))
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
