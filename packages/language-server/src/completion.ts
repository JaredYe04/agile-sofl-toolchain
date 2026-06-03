/**
 * Completion provider (first-phase contexts).
 */

import { parse, resolveScope } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, InsertTextFormat, type CompletionItem, type Position } from 'vscode-languageserver/node.js'

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

function moduleScopeSymbols(document: TextDocument, position: Position): string[] {
  const { ast } = parse(document.getText())
  if (!ast || ast.type !== 'program') return []
  const scopeResult = resolveScope(ast)
  const offset = document.offsetAt(position)
  let currentMod = ast.modules[0]
  for (const mod of ast.modules) {
    if (mod.span.start <= offset && offset <= mod.span.end) currentMod = mod
  }
  const scope = scopeResult.root?.module.name === currentMod.name
    ? scopeResult.root
    : scopeResult.root
  if (!scope) return []
  const names: string[] = []
  for (const sym of scope.symbols.values()) {
    if (sym.moduleName === currentMod.name) names.push(sym.name)
  }
  return names
}

export function getCompletions(document: TextDocument, position: Position): CompletionItem[] {
  const prefix = linePrefix(document, position)
  const trimmed = prefix.trimStart()

  if (/:\s*[A-Za-z_]*$/.test(prefix)) {
    const partial = prefix.match(/:\s*([A-Za-z_]*)$/)?.[1] ?? ''
    const scopeTypes = moduleScopeSymbols(document, position)
    return [...BASIC_TYPES, ...scopeTypes]
      .filter((name) => name.startsWith(partial))
      .map((name) => ({ label: name, kind: CompletionItemKind.TypeParameter }))
  }

  if (/^\s*(process|function)\b/.test(trimmed) === false && /^\s*(FSF|ext|decom|comment)\b/.test(trimmed)) {
    return PROCESS_KEYWORDS.filter((k) => k.startsWith(trimmed.split(/\s+/).pop() ?? '')).map((k) => ({
      label: k,
      kind: CompletionItemKind.Keyword
    }))
  }

  if (/\bFSF\s*:\s*/.test(prefix) || prefix.includes('others')) {
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
    const { ast } = parse(document.getText())
    if (ast?.type === 'program') {
      return ast.modules.map((m) => ({ label: m.name, kind: CompletionItemKind.Module }))
    }
  }

  const scopeNames = moduleScopeSymbols(document, position)
  return scopeNames.map((name) => ({ label: name, kind: CompletionItemKind.Variable }))
}
