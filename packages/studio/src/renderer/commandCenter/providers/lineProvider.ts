import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'

export const lineProvider: CommandCenterProvider = {
  id: 'go-to-line',
  prefix: ':',
  priority: 10,
  isEnabled: (ctx) => ctx.activeTab?.kind === 'document',
  query(query, ctx) {
    const trimmed = query.trim()
    if (!trimmed) {
      return [
        {
          id: 'line:hint',
          kind: 'command',
          label: ctx.t('commandCenter.lineHint'),
          group: 'commandCenter.group.line',
          score: 1,
          execute: () => {}
        }
      ]
    }

    const match = trimmed.match(/^(\d+)(?::(\d+))?$/)
    if (!match) return []

    const line = Number.parseInt(match[1], 10)
    const column = match[2] ? Number.parseInt(match[2], 10) : 1
    if (!Number.isFinite(line) || line < 1) return []

    return [
      {
        id: `line:${line}:${column}`,
        kind: 'command',
        label: ctx.t('commandCenter.goToLine', { line, column }),
        group: 'commandCenter.group.line',
        score: 50,
        execute: () => {
          ctx.revealSpan({ start: 0, end: 0, line, column })
        }
      }
    ]
  }
}
