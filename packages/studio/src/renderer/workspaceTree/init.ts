import { registerWorkspaceTreeMenuProvider } from './registry'
import { builtinWorkspaceTreeMenuProvider } from './builtinProvider'

let initialized = false

export function initWorkspaceTreeMenuProviders(): void {
  if (initialized) return
  initialized = true
  registerWorkspaceTreeMenuProvider(builtinWorkspaceTreeMenuProvider)
}
