/**
 * AST normalization for round-trip comparison.
 */

import type { ProgramNode, ModuleNode } from '../ast/nodes.js'

export function normalizeAST(ast: ProgramNode): ProgramNode {
  return {
    ...ast,
    modules: ast.modules.map(normalizeModule)
  }
}

function normalizeModule(mod: ModuleNode): ModuleNode {
  return { ...mod }
}

export function stripSpans<T>(node: T): T {
  if (node === null || node === undefined) return node
  if (typeof node !== 'object') return node
  if (Array.isArray(node)) {
    return node.map(stripSpans) as T
  }
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'span' || key.endsWith('Span')) continue
    result[key] = stripSpans(value)
  }
  return result as T
}

export function astEqual(a: unknown, b: unknown, ignoreSpan = true): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return a === b

  const strip = (obj: unknown) => (ignoreSpan ? stripSpans(obj) : obj)
  const A = strip(a) as Record<string, unknown>
  const B = strip(b) as Record<string, unknown>

  const keysA = Object.keys(A).sort()
  const keysB = Object.keys(B).sort()
  if (keysA.length !== keysB.length) return false

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(B, k)) return false
    const va = A[k]
    const vb = B[k]
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false
      for (let i = 0; i < va.length; i++) {
        if (!astEqual(va[i], vb[i], ignoreSpan)) return false
      }
    } else if (!astEqual(va, vb, ignoreSpan)) {
      return false
    }
  }
  return true
}
