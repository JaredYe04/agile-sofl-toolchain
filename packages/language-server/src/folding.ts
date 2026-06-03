/**
 * Folding ranges for modules, processes, functions, and FSF blocks.
 */

import { parse } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { FoldingRange } from 'vscode-languageserver/node.js'
import { FoldingRangeKind } from 'vscode-languageserver/node.js'

export function collectFoldingRanges(document: TextDocument): FoldingRange[] {
  const source = document.getText()
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return []

  const ranges: FoldingRange[] = []

  for (const mod of ast.modules) {
    if (mod.span.end > mod.span.start) {
      ranges.push({
        startLine: document.positionAt(mod.span.start).line,
        endLine: document.positionAt(mod.span.end).line,
        kind: FoldingRangeKind.Region
      })
    }

    for (const proc of mod.processes) {
      if (proc.span.end > proc.span.start) {
        ranges.push({
          startLine: document.positionAt(proc.span.start).line,
          endLine: document.positionAt(proc.span.end).line,
          kind: FoldingRangeKind.Region
        })
      }
      const fsf = proc.body?.fsf
      if (fsf && fsf.span.end > fsf.span.start) {
        ranges.push({
          startLine: document.positionAt(fsf.span.start).line,
          endLine: document.positionAt(fsf.span.end).line,
          kind: FoldingRangeKind.Region
        })
      }
    }

    for (const fn of mod.functions) {
      if (fn.span.end > fn.span.start) {
        ranges.push({
          startLine: document.positionAt(fn.span.start).line,
          endLine: document.positionAt(fn.span.end).line,
          kind: FoldingRangeKind.Region
        })
      }
    }
  }

  return ranges.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)
}

/** Test helper: folding range as line span string. */
export function formatFoldingRanges(ranges: FoldingRange[]): string[] {
  return ranges.map((r) => `${r.startLine}-${r.endLine}`)
}
