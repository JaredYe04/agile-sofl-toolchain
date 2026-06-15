import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'
import { builtinCommands } from '../commands/builtinCommands'

function matchCommand(cmd: { titleKey: string; detailKey?: string }, query: string, t: CommandCenterContext['t']): boolean {
  if (!query) return true
  const title = t(cmd.titleKey).toLowerCase()
  const detail = cmd.detailKey ? t(cmd.detailKey).toLowerCase() : ''
  const needle = query.toLowerCase()
  return title.includes(needle) || detail.includes(needle) || cmd.id.toLowerCase().includes(needle)
}

export const commandsProvider: CommandCenterProvider = {
  id: 'commands',
  prefix: '>',
  priority: 10,
  query(query, ctx) {
    const items: CommandCenterItem[] = []

    for (const cmd of builtinCommands) {
      if (cmd.when && !cmd.when(ctx)) continue
      if (!matchCommand(cmd, query, ctx.t)) continue
      items.push({
        id: `cmd:${cmd.id}`,
        kind: 'command',
        label: ctx.t(cmd.titleKey),
        detail: cmd.detailKey ? ctx.t(cmd.detailKey) : undefined,
        group: 'commandCenter.group.commands',
        score: 40,
        execute: async () => {
          await cmd.run(ctx)
        }
      })
    }

    return items
  }
}
