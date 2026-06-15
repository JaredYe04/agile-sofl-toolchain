import type { InformalProcess } from '../model.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import type { AspecDiagnostic } from '../model.js'

function sanitizeInformalText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function slugForOutcome(outcome: string, index: number): string {
  const m = outcome.match(/(\w+)\s*(=|is)\s*(\d+|\w+)/i)
  if (m) return `${m[1]} = ${m[3]}`
  return `result_${index} = 0`
}

export function buildProcessFsf(proc: InformalProcess): string {
  if (!proc.scenarios?.length) {
    return 'others && true'
  }

  const bottom = proc.refinementHints?.bottomLevel ?? false
  const lines: string[] = []
  let hasOthers = false

  for (let i = 0; i < proc.scenarios.length; i++) {
    const scen = proc.scenarios[i]!
    if (scen.condition.toLowerCase().includes('other')) {
      hasOthers = true
      lines.push(`others && ${slugForOutcome(scen.outcome, i)}`)
      continue
    }
    let test: string
    if (bottom) {
      test = proc.preconditions?.trim() ? sanitizeInformalText(proc.preconditions) : 'true'
      if (test !== 'true' && !/^[a-zA-Z_(]/.test(test)) {
        test = sanitizeInformalText(scen.condition)
      }
    } else {
      const pre = proc.preconditions?.trim()
      test = pre
        ? `informal ${sanitizeInformalText(pre)} and ${sanitizeInformalText(scen.condition)}`
        : `informal ${sanitizeInformalText(scen.condition)}`
    }
    let def = slugForOutcome(scen.outcome, i)
    if (proc.postconditions?.trim()) {
      def = `${def}; informal ${sanitizeInformalText(proc.postconditions)}`
    }
    lines.push(`${test} && ${def}`)
  }

  if (!hasOthers) {
    lines.push('others && true')
  }

  return lines.map((line, i) => (i < lines.length - 1 ? `${line} ||` : line)).join('\n')
}

export function buildFunctionBody(fn: { bodyHint?: string; refinementHints?: { bottomLevel?: boolean } }): string {
  const hint = fn.bodyHint?.trim()
  if (!hint) return 'undefined'
  const bottom = fn.refinementHints?.bottomLevel ?? false
  if (bottom && /^[a-zA-Z_(]/.test(hint)) return hint
  return `informal ${sanitizeInformalText(hint)}`
}

export function aspecCommentTag(aspecId: string, notes?: string): string {
  const tag = `aspec_${aspecId.replace(/-/g, '_')}`
  const sanitizedNotes = notes?.trim().replace(/[.@]/g, ' ').replace(/\s+/g, ' ').trim()
  const body = sanitizedNotes ? `${tag} ${sanitizedNotes}` : tag
  return `comment: informal ${body}`
}

export function aspecTagToken(aspecId: string): string {
  return `aspec_${aspecId.replace(/-/g, '_')}`
}

export function mapTypeHint(typeHint: string | undefined, warnings: AspecDiagnostic[], path: string): string {
  if (!typeHint?.trim()) {
    warnings.push(
      createDiagnostic(DiagnosticCodes.REFINE_TYPE_FALLBACK, `Missing typeHint at ${path}, using nat`, 'warning', path)
    )
    return 'nat'
  }
  return typeHint.trim()
}

export function buildProcessSignature(proc: InformalProcess): string {
  const inputs = proc.signature?.inputs ?? []
  const outputs = proc.signature?.outputs ?? []
  const inPart =
    inputs.length === 0
      ? ''
      : inputs.length === 1
        ? `(${inputs[0]!.name}: ${inputs[0]!.typeHint ?? 'nat'})`
        : `(${inputs.map((p) => `${p.name}: ${p.typeHint ?? 'nat'}`).join(', ')})`
  const outPart =
    outputs.length === 0
      ? ''
      : outputs.map((p) => `${p.name}: ${p.typeHint ?? 'nat'}`).join(', ')
  if (inPart && outPart) return `${inPart} ${outPart}`
  if (inPart) return inPart
  if (outPart) return `() ${outPart}`
  return '()'
}

export function buildFunctionSignature(fn: { signature?: InformalProcess['signature']; name: string }): string {
  const inputs = fn.signature?.inputs ?? []
  const outputs = fn.signature?.outputs ?? []
  const inList = inputs.map((p) => `${p.name}: ${p.typeHint ?? 'nat'}`).join(', ')
  const ret = outputs[0]?.typeHint ?? 'nat'
  return `(${inList}): ${ret}`
}
