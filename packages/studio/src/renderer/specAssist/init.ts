import { registerHybridAssistantProvider, registerInformalAssistantProvider } from './registry'
import { heuristicInformalProvider } from './heuristicInformal'
import { heuristicHybridProvider, reservedHybridAiProvider, reservedInformalAiProvider } from './reservedAi'

let initialized = false

export function initSpecAssistProviders(): void {
  if (initialized) return
  initialized = true
  registerInformalAssistantProvider(heuristicInformalProvider)
  registerInformalAssistantProvider(reservedInformalAiProvider)
  registerHybridAssistantProvider(heuristicHybridProvider)
  registerHybridAssistantProvider(reservedHybridAiProvider)
}
