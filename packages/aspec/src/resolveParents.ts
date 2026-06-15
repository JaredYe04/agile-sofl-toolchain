import type { AspecDocument } from './model.js'

/** Resolve parent module id to parent module name for ASFL `Child / Parent` syntax. */
export function resolveModuleParents(document: AspecDocument): void {
  const byId = new Map(document.modules.map((m) => [m.id, m]))
  for (const mod of document.modules) {
    if (mod.parent) {
      const parent = byId.get(mod.parent)
      mod.parentModuleName = parent?.name
    }
  }
}

export function findModuleById(document: AspecDocument, id: string) {
  return document.modules.find((m) => m.id === id)
}
