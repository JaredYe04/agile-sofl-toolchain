import { parse } from '@agile-sofl/parser'

export type SignatureValidationResult = { ok: true } | { ok: false; error: string }

function duplicateNames(groups: Array<{ names: string }>): string | null {
  const seen = new Set<string>()
  for (const g of groups) {
    for (const raw of g.names.split(',')) {
      const name = raw.trim()
      if (!name) continue
      if (seen.has(name)) return name
      seen.add(name)
    }
  }
  return null
}

function parseParamNames(signature: string): Array<{ names: string }> {
  const groups: Array<{ names: string }> = []
  const inner = signature.match(/\(([^)]*)\)/)
  if (!inner) return groups
  const body = inner[1].trim()
  if (!body) return groups
  for (const part of body.split(',')) {
    const m = part.trim().match(/^([^:]+):/)
    if (m) groups.push({ names: m[1].trim() })
  }
  return groups
}

export function validateProcessSignature(signature: string): SignatureValidationResult {
  const sig = signature.trim()
  if (!sig) return { ok: false, error: 'Signature cannot be empty' }
  const probe = `module SYSTEM_SigVal;\nprocess P ${sig}\nFSF :\nothers && true\nend_process\nend_module`
  const { diagnostics } = parse(probe)
  const errors = diagnostics.filter((d) => d.severity === 'error')
  if (errors.length) return { ok: false, error: errors[0]!.message }
  const dup = duplicateNames(parseParamNames(sig))
  if (dup) return { ok: false, error: `Duplicate parameter name: ${dup}` }
  return { ok: true }
}

export function validateFunctionSignature(signature: string): SignatureValidationResult {
  const sig = signature.trim()
  if (!sig) return { ok: false, error: 'Signature cannot be empty' }
  const sigText = sig.startsWith('(') ? sig : `(${sig})`
  const probe = `module SYSTEM_SigVal;\nfunction F${sigText}\n== 0\nend_function\nend_module`
  const { diagnostics } = parse(probe)
  const errors = diagnostics.filter((d) => d.severity === 'error')
  if (errors.length) return { ok: false, error: errors[0]!.message }
  const inner = sigText.match(/\(([^)]*)\)/)
  if (inner) {
    const dup = duplicateNames(parseParamNames(`(${inner[1]})`))
    if (dup) return { ok: false, error: `Duplicate parameter name: ${dup}` }
  }
  if (!sigText.includes(':')) return { ok: false, error: 'Return type is required' }
  return { ok: true }
}
