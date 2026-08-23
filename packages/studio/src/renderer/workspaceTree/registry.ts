import type {
  WorkspaceTreeContext,
  WorkspaceTreeMenuItem,
  WorkspaceTreeMenuProvider
} from './types'

const providers: WorkspaceTreeMenuProvider[] = []

export function registerWorkspaceTreeMenuProvider(provider: WorkspaceTreeMenuProvider): void {
  const idx = providers.findIndex((p) => p.id === provider.id)
  if (idx >= 0) providers[idx] = provider
  else providers.push(provider)
}

export function unregisterWorkspaceTreeMenuProvider(id: string): void {
  const idx = providers.findIndex((p) => p.id === id)
  if (idx >= 0) providers.splice(idx, 1)
}

export function buildWorkspaceTreeMenu(ctx: WorkspaceTreeContext): WorkspaceTreeMenuItem[] {
  const sorted = [...providers].sort((a, b) => b.priority - a.priority)
  const seen = new Set<string>()
  const out: WorkspaceTreeMenuItem[] = []
  for (const provider of sorted) {
    if (provider.isEnabled && !provider.isEnabled(ctx)) continue
    for (const item of provider.items(ctx)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }
  return out
}

export function listWorkspaceTreeMenuProviders(): WorkspaceTreeMenuProvider[] {
  return [...providers]
}
