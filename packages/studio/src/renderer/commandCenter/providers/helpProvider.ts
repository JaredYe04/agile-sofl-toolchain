import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'

export const helpProvider: CommandCenterProvider = {
  id: 'help',
  prefix: '?',
  priority: 10,
  query(_query, ctx) {
    const hints = [
      { key: 'commandCenter.help.quickOpen', prefix: 'Ctrl+P' },
      { key: 'commandCenter.help.commands', prefix: '>' },
      { key: 'commandCenter.help.symbols', prefix: '@' },
      { key: 'commandCenter.help.line', prefix: ':' },
      { key: 'commandCenter.help.diagnostics', prefix: '!' }
    ]

    return hints.map((hint, i) => ({
      id: `help:${i}`,
      kind: 'help' as const,
      label: ctx.t(hint.key),
      detail: hint.prefix,
      group: 'commandCenter.group.help',
      score: 10,
      execute: () => {}
    }))
  }
}
