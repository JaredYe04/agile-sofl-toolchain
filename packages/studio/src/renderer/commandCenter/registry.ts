import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from './types'
import { parseCommandQuery } from './types'

const providers: CommandCenterProvider[] = []

export function registerCommandCenterProvider(provider: CommandCenterProvider): void {
  const idx = providers.findIndex((p) => p.id === provider.id)
  if (idx >= 0) providers[idx] = provider
  else providers.push(provider)
}

export function unregisterCommandCenterProvider(id: string): void {
  const idx = providers.findIndex((p) => p.id === id)
  if (idx >= 0) providers.splice(idx, 1)
}

export function getRegisteredProviders(): readonly CommandCenterProvider[] {
  return providers
}

export async function queryCommandCenter(
  rawQuery: string,
  ctx: CommandCenterContext
): Promise<CommandCenterItem[]> {
  const { prefix, query } = parseCommandQuery(rawQuery)
  const active = providers
    .filter((p) => (p.prefix ?? '') === prefix)
    .filter((p) => p.isEnabled?.(ctx) ?? true)
    .sort((a, b) => a.priority - b.priority)

  const merged: CommandCenterItem[] = []
  for (const provider of active) {
    const items = await provider.query(query, ctx)
    merged.push(...items)
  }

  return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
