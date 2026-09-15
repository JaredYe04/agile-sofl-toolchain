import type { ProgramNode, Span } from '@agile-sofl/parser'
import { namesEqual } from './hybridIds.js'
import { sliceText, toSerializableSpan } from './span.js'
import type { VisualParseDiagnostic } from './visualParse.js'

export const VISUAL_DUPLICATE_CODE = 'VISUAL_DUPLICATE_NAME'

function normalizeInvariantKey(source: string, span: Span): string {
  return sliceText(source, span)
    .replace(/^inv\b/i, '')
    .replace(/;+\s*$/, '')
    .trim()
}

function pushDuplicate(
  out: VisualParseDiagnostic[],
  moduleName: string,
  kind: string,
  label: string,
  span: Span
): void {
  out.push({
    code: VISUAL_DUPLICATE_CODE,
    message: `Duplicate ${kind} "${label}" in module "${moduleName}".`,
    severity: 'error',
    span: toSerializableSpan(span),
    source: 'visual'
  })
}

function checkIdentifierDuplicates(
  out: VisualParseDiagnostic[],
  moduleName: string,
  kind: string,
  items: Array<{ name: string; span: Span }>
): void {
  const seen = new Map<string, number>()
  for (const item of items) {
    const key = item.name
    if (!key) continue
    if (seen.has(key)) {
      pushDuplicate(out, moduleName, kind, key, item.span)
    } else {
      seen.set(key, 1)
    }
  }
}

/** Detect duplicate entity names in a parsed hybrid program (visual editor). */
export function collectVisualDuplicateDiagnostics(
  program: ProgramNode,
  source: string
): VisualParseDiagnostic[] {
  const out: VisualParseDiagnostic[] = []

  const moduleKeys = new Map<string, string>()
  for (const mod of program.modules) {
    const name = mod.name.trim()
    if (!name) continue
    const existing = [...moduleKeys.keys()].find((k) => namesEqual(k, name))
    if (existing) {
      pushDuplicate(out, existing, 'module', name, mod.span)
    } else {
      moduleKeys.set(name, name)
    }
  }

  for (const mod of program.modules) {
    const moduleName = mod.name
    checkIdentifierDuplicates(
      out,
      moduleName,
      'constant',
      mod.consts.map((c) => ({ name: c.name, span: c.span }))
    )
    checkIdentifierDuplicates(
      out,
      moduleName,
      'type',
      mod.types.map((t) => ({ name: t.name, span: t.span }))
    )
    checkIdentifierDuplicates(
      out,
      moduleName,
      'variable',
      mod.vars.map((v) => ({ name: v.variable.name, span: v.span }))
    )
    checkIdentifierDuplicates(
      out,
      moduleName,
      'process',
      mod.processes.map((p) => ({ name: p.name, span: p.span }))
    )
    checkIdentifierDuplicates(
      out,
      moduleName,
      'function',
      mod.functions.map((f) => ({ name: f.name, span: f.span }))
    )

    for (const t of mod.types) {
      if (t.typeExpr.type !== 'composed_type') continue
      checkIdentifierDuplicates(
        out,
        moduleName,
        `type field in "${t.name}"`,
        t.typeExpr.fields.map((f) => ({ name: f.name, span: f.span }))
      )
    }

    const invSeen = new Map<string, number>()
    for (const inv of mod.invariants) {
      const key = normalizeInvariantKey(source, inv.span)
      if (!key) continue
      if (invSeen.has(key)) {
        pushDuplicate(out, moduleName, 'invariant', key, inv.span)
      } else {
        invSeen.set(key, 1)
      }
    }
  }

  return out
}
