/**
 * Document symbols (outline) from AST walk.
 */

import { parse, walk, textOf } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'

export function collectDocumentSymbols(document: TextDocument): DocumentSymbol[] {
  const { ast } = parse(document.getText())
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
        range: spanToRange(document, mod.span),
        selectionRange: spanToRange(document, mod.nameSpan ?? mod.span),
        children
      })

      for (const c of mod.consts) {
        children.push({
          name: c.name,
          kind: SymbolKind.Constant,
          range: spanToRange(document, c.span),
          selectionRange: spanToRange(document, c.span)
        })
      }
      for (const t of mod.types) {
        children.push({
          name: t.name,
          kind: SymbolKind.Class,
          range: spanToRange(document, t.span),
          selectionRange: spanToRange(document, t.span)
        })
      }
      for (const v of mod.vars) {
        children.push({
          name: v.variable.name,
          kind: SymbolKind.Variable,
          range: spanToRange(document, v.span),
          selectionRange: spanToRange(document, v.variable.span)
        })
      }
      for (const p of mod.processes) {
        const procChildren: DocumentSymbol[] = []
        const fsf = p.body?.fsf
        if (fsf) {
          const count = fsf.scenarios.length + (fsf.others ? 1 : 0)
          procChildren.push({
            name: 'FSF',
            detail: `${count} branch${count === 1 ? '' : 'es'}`,
            kind: SymbolKind.Event,
            range: spanToRange(document, fsf.span),
            selectionRange: spanToRange(document, fsf.span)
          })
        }
        const comment = textOf(p.body?.comment)
        if (comment) {
          const commentSpan =
            p.body?.comment && typeof p.body.comment === 'object' && 'span' in p.body.comment
              ? p.body.comment.span
              : p.span
          procChildren.push({
            name: 'comment',
            detail: comment.length > 40 ? comment.slice(0, 39) + '…' : comment,
            kind: SymbolKind.String,
            range: spanToRange(document, commentSpan),
            selectionRange: spanToRange(document, commentSpan)
          })
        }
        children.push({
          name: p.name,
          detail: p.alias ? `equal ${p.alias.module ? p.alias.module + '.' : ''}${p.alias.name}` : undefined,
          kind: SymbolKind.Method,
          range: spanToRange(document, p.span),
          selectionRange: spanToRange(document, p.nameSpan ?? p.span),
          children: procChildren.length ? procChildren : undefined
        })
      }
      for (const f of mod.functions) {
        children.push({
          name: f.name,
          kind: SymbolKind.Function,
          range: spanToRange(document, f.span),
          selectionRange: spanToRange(document, f.nameSpan ?? f.span)
        })
      }
    }
  })

  return symbols
}
