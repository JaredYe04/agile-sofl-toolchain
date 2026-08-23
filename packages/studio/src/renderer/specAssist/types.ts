import type { PatchAspecPayload } from '../../preload/index'

export type InformalAssistInput = {
  source: string
  selection?: string
}

export type InformalSuggestion = {
  id: string
  title: string
  kind: 'insert' | 'patch-aspec'
  insertText?: string
  patch?: Omit<PatchAspecPayload, 'source'>
}

export interface InformalAssistantProvider {
  id: string
  labelKey: string
  suggest: (input: InformalAssistInput) => InformalSuggestion[] | Promise<InformalSuggestion[]>
}

export type HybridAssistInput = {
  source: string
  moduleName: string | null
  selection?: string
}

export type HybridSuggestion = {
  id: string
  title: string
  kind: 'patch-process' | 'insert'
  processName?: string
  template?: string
  insertText?: string
}

export interface HybridAssistantProvider {
  id: string
  labelKey: string
  suggest: (input: HybridAssistInput) => HybridSuggestion[] | Promise<HybridSuggestion[]>
}
