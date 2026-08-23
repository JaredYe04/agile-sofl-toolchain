import type { HybridAssistantProvider, InformalAssistantProvider } from './types'

const informalProviders: InformalAssistantProvider[] = []
const hybridProviders: HybridAssistantProvider[] = []

export function registerInformalAssistantProvider(provider: InformalAssistantProvider): void {
  const idx = informalProviders.findIndex((p) => p.id === provider.id)
  if (idx >= 0) informalProviders[idx] = provider
  else informalProviders.push(provider)
}

export function registerHybridAssistantProvider(provider: HybridAssistantProvider): void {
  const idx = hybridProviders.findIndex((p) => p.id === provider.id)
  if (idx >= 0) hybridProviders[idx] = provider
  else hybridProviders.push(provider)
}

export function listInformalAssistantProviders(): InformalAssistantProvider[] {
  return [...informalProviders]
}

export function listHybridAssistantProviders(): HybridAssistantProvider[] {
  return [...hybridProviders]
}
