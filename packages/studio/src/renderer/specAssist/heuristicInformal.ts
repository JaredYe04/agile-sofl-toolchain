import type { InformalSuggestion } from './types'
import { nextId } from './ident'

const TAGGED = /^(?:[-*]\s*)?(功能|数据|约束)\s*[:：]\s*(.+)$/
const NUMBERED = /^(?:[-*]\s*)?([FDC])_(\d+)\s*[:：]?\s*(.+)$/

export function extractInformalDraft(text: string): InformalSuggestion[] {
  const suggestions: InformalSuggestion[] = []
  const lines = text.split(/\r?\n/)
  let n = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const tagged = TAGGED.exec(line)
    const numbered = NUMBERED.exec(line)
    let kind: 'fn' | 'data' | 'con' | null = null
    let body = ''
    if (tagged) {
      body = tagged[2]!.trim()
      kind = tagged[1] === '数据' ? 'data' : tagged[1] === '约束' ? 'con' : 'fn'
    } else if (numbered) {
      body = numbered[3]!.trim()
      kind = numbered[1] === 'D' ? 'data' : numbered[1] === 'C' ? 'con' : 'fn'
    }
    if (!kind || !body) continue
    n++
    if (kind === 'data') {
      suggestions.push({
        id: `data-${n}`,
        title: body,
        kind: 'patch-aspec',
        patch: {
          action: 'add-variable',
          variable: { id: nextId('d'), name: `D_${n}`, description: body }
        }
      })
    } else if (kind === 'con') {
      suggestions.push({
        id: `con-${n}`,
        title: body,
        kind: 'patch-aspec',
        patch: {
          action: 'add-invariant',
          invariant: { id: nextId('c'), description: body, textHint: body }
        }
      })
    } else {
      suggestions.push({
        id: `fn-${n}`,
        title: body,
        kind: 'patch-aspec',
        patch: {
          action: 'add-process',
          process: {
            id: nextId('f'),
            name: `F_${n}`,
            description: body,
            scenarios: [{ id: nextId('sc'), condition: 'typical case', outcome: body }]
          }
        }
      })
    }
  }
  return suggestions
}

export const heuristicInformalProvider = {
  id: 'studio.informal.heuristic',
  labelKey: 'informal.assist.extract',
  suggest(input: { source: string; selection?: string }) {
    const text = (input.selection?.trim() || input.source).slice(0, 8000)
    return extractInformalDraft(text)
  }
}
