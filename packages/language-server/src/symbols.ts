/**
 * Document symbols (outline) from AST walk.
 */

import { check, walk } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node.js'
import { spanToRange } from './lsp-utils.js'

export function collectDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const { ast } = check(document.getText())
  if (!ast || ast.type !== 'program') {
    return []
  }

  const symbols: DocumentSymbol[] = []

  walk(ast, {
    enterModule(mod) {
      const children: DocumentSymbol[] = []
      symbols.push({
        name: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
        detail: mod.parent ? `/${mod.parent.name}` : undefined,
        kind: SymbolKind.Module,
        range: spanToRange(mod.span, document),
        selectionRange: spanToRange(mod.span, document),
        children
      })
      const moduleSymbol = symbols[symbols.length - 1]

      for (const c of mod.consts) {
        children.push({
          name: c.name,
          kind: SymbolKind.Constant,
          range: spanToRange(c.span, document),
          selectionRange: spanToRange(c.span, document)
        })
      }
      for (const t of mod.types) {
        children.push({
          name: t.name,
          kind: SymbolKind.Class,
          range: spanToRange(t.span, document),
          selectionRange: spanToRange(t.span, document)
        })
      }
      for (const v of mod.vars) {
        children.push({
          name: v.variable.name,
          kind: SymbolKind.Variable,
          range: spanToRange(v.span, document),
          selectionRange: spanToRange(v.variable.span, document)
        })
      }
      for (const p of mod.processes) {
        children.push({
          name: p.name,
          detail: p.alias ? `equal ${p.alias.module ? p.alias.module + '.' : ''}${p.alias.name}` : undefined,
          kind: SymbolKind.Method,
          range: spanToRange(p.span, document),
          selectionRange: spanToRange(p.span, document)
        })
      }
      for (const f of mod.functions) {
        children.push({
          name: f.name,
          kind: SymbolKind.Function,
          range: spanToRange(f.span, document),
          selectionRange: spanToRange(f.span, document)
        })
      }

      void moduleSymbol
    }
  })

  return symbols
}
