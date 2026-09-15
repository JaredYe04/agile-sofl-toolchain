import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import type { AspecDiagnostic, InformalModule } from '../model.js'

const INFORMAL_DUPLICATE_NAME = DiagnosticCodes.STYLE_DUPLICATE_NAME

function norm(s: string | undefined): string {
  return (s ?? '').trim()
}

function invKey(inv: { textHint?: string; description?: string }): string {
  const hint = norm(inv.textHint)
  if (hint) return hint
  return norm(inv.description)
}

function checkNames(
  diagnostics: AspecDiagnostic[],
  moduleName: string,
  kind: string,
  items: Array<{ id: string; name: string }>
): void {
  const seen = new Set<string>()
  for (const item of items) {
    const name = norm(item.name)
    if (!name) continue
    if (seen.has(name)) {
      diagnostics.push(
        createDiagnostic(
          INFORMAL_DUPLICATE_NAME,
          `Duplicate ${kind} name "${name}" in module "${moduleName}".`,
          'error',
          item.id
        )
      )
    } else {
      seen.add(name)
    }
  }
}

function checkInvariantHints(
  diagnostics: AspecDiagnostic[],
  moduleName: string,
  items: Array<{ id: string; textHint?: string; description?: string }>
): void {
  const seen = new Set<string>()
  for (const item of items) {
    const key = invKey(item)
    if (!key) continue
    if (seen.has(key)) {
      diagnostics.push(
        createDiagnostic(
          INFORMAL_DUPLICATE_NAME,
          `Duplicate invariant text in module "${moduleName}": "${key}".`,
          'error',
          item.id
        )
      )
    } else {
      seen.add(key)
    }
  }
}

/** Duplicate display names within informal modules (visual editor). */
export function validateInformalDuplicateNames(modules: InformalModule[]): AspecDiagnostic[] {
  const diagnostics: AspecDiagnostic[] = []
  const moduleNames = new Set<string>()
  for (const mod of modules) {
    const name = norm(mod.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (moduleNames.has(key)) {
      diagnostics.push(
        createDiagnostic(
          INFORMAL_DUPLICATE_NAME,
          `Duplicate module name "${name}".`,
          'error',
          mod.id
        )
      )
    } else {
      moduleNames.add(key)
    }
  }

  for (const mod of modules) {
    const moduleName = norm(mod.name) || mod.id
    checkNames(diagnostics, moduleName, 'type', mod.types ?? [])
    checkNames(diagnostics, moduleName, 'constant', mod.constants ?? [])
    checkNames(diagnostics, moduleName, 'variable', mod.variables ?? [])
    checkNames(diagnostics, moduleName, 'process', mod.processes ?? [])
    checkNames(diagnostics, moduleName, 'function', mod.functions ?? [])
    checkInvariantHints(diagnostics, moduleName, mod.invariants ?? [])
  }

  return diagnostics
}
