import type { HybridSuggestion } from './types'
import { processStubTemplate, toAsflIdent } from './ident'

export const heuristicHybridProvider = {
  id: 'studio.hybrid.heuristic',
  labelKey: 'hybrid.assist.skeleton',
  suggest(input: { source: string; moduleName: string | null; selection?: string }): HybridSuggestion[] {
    const phrase = input.selection?.trim()
    if (!phrase || !input.moduleName) return []
    const name = toAsflIdent(phrase)
    return [
      {
        id: `proc-${name}`,
        title: name,
        kind: 'patch-process',
        processName: name,
        template: processStubTemplate(name, phrase)
      }
    ]
  }
}

export const reservedInformalAiProvider = {
  id: 'studio.informal.ai',
  labelKey: 'informal.assist.extract',
  suggest() {
    return []
  }
}

export const reservedHybridAiProvider = {
  id: 'studio.hybrid.ai',
  labelKey: 'hybrid.assist.skeleton',
  suggest() {
    return []
  }
}
