import type { PatchAspecPayload } from '../../preload/index'
import type { InformalSuggestion } from './types'
import { nextId } from './ident'

async function ensureModule(
  source: string
): Promise<{ source: string; moduleId: string }> {
  const model = await window.studio?.buildInformalModel?.(source)
  const existing = model?.modules[0]
  if (existing?.id) return { source, moduleId: existing.id }
  const module = { id: nextId('mod'), name: 'Main', description: 'Main module' }
  const next = await window.studio!.patchAspec({
    source,
    action: 'add-module',
    module
  })
  return { source: next, moduleId: module.id }
}

export async function applyInformalSuggestion(
  source: string,
  suggestion: InformalSuggestion
): Promise<string> {
  if (suggestion.kind === 'insert' && suggestion.insertText) {
    const sep = source.endsWith('\n') ? '' : '\n'
    return `${source}${sep}${suggestion.insertText}\n`
  }
  if (suggestion.kind !== 'patch-aspec' || !suggestion.patch || !window.studio?.patchAspec) {
    return source
  }
  const patch = { ...suggestion.patch }
  if (
    patch.action === 'add-process' ||
    patch.action === 'add-variable' ||
    patch.action === 'add-invariant' ||
    patch.action === 'add-function' ||
    patch.action === 'add-type' ||
    patch.action === 'add-constant'
  ) {
    const ensured = await ensureModule(source)
    source = ensured.source
    patch.moduleId = patch.moduleId ?? ensured.moduleId
  }
  return window.studio.patchAspec({ source, ...patch } as PatchAspecPayload)
}
