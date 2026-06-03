/**
 * Internal type representation for type checking.
 */

import type { TypeExprNode } from '../ast/nodes.js'

export type InternalType =
  | { kind: 'basic'; name: string }
  | { kind: 'named'; name: string; module?: string }
  | { kind: 'set'; element: InternalType }
  | { kind: 'seq'; element: InternalType }
  | { kind: 'map'; domain: InternalType; range: InternalType }
  | { kind: 'product'; elements: InternalType[] }
  | { kind: 'composed'; fields: { name: string; type: InternalType }[] }
  | { kind: 'union'; variants: InternalType[] }
  | { kind: 'enum'; values: string[] }
  | { kind: 'unknown' }

const NUMERIC_RANK: Record<string, number> = {
  nat0: 0,
  nat: 1,
  int: 2,
  real: 3
}

export function isNumericType(t: InternalType): boolean {
  return t.kind === 'basic' && t.name in NUMERIC_RANK
}

export function numericRank(name: string): number | undefined {
  return NUMERIC_RANK[name]
}

/** True when `a` is a numeric subtype of `b` (nat0 ⊂ nat ⊂ int ⊂ real). */
export function numericSubtype(a: InternalType, b: InternalType): boolean {
  if (a.kind !== 'basic' || b.kind !== 'basic') return false
  const ra = NUMERIC_RANK[a.name]
  const rb = NUMERIC_RANK[b.name]
  if (ra === undefined || rb === undefined) return false
  return ra <= rb
}

export function typeExprToInternal(node: TypeExprNode): InternalType {
  switch (node.type) {
    case 'basic_type':
      return { kind: 'basic', name: node.name }
    case 'named_type':
      return {
        kind: 'named',
        name: node.qualified.name,
        module: node.qualified.module
      }
    case 'enum_type':
      return { kind: 'enum', values: node.values }
    case 'set_type':
      return { kind: 'set', element: typeExprToInternal(node.element) }
    case 'seq_type':
      return { kind: 'seq', element: typeExprToInternal(node.element) }
    case 'composed_type':
      return {
        kind: 'composed',
        fields: node.fields.map((f) => ({ name: f.name, type: typeExprToInternal(f.typeExpr) }))
      }
    case 'product_type':
      return { kind: 'product', elements: node.elements.map(typeExprToInternal) }
    case 'map_type':
      return {
        kind: 'map',
        domain: typeExprToInternal(node.domain),
        range: typeExprToInternal(node.range)
      }
    case 'union_type':
      return {
        kind: 'union',
        variants: node.isUniversal ? [] : node.variants.map(typeExprToInternal)
      }
    default:
      return { kind: 'unknown' }
  }
}

function namedKey(name: string, module?: string): string {
  return module ? `${module}.${name}` : name
}

export function resolveInternalType(
  t: InternalType,
  env: Map<string, InternalType>,
  depth = 0
): InternalType {
  if (depth > 32) return t
  switch (t.kind) {
    case 'named': {
      const key = namedKey(t.name, t.module)
      const resolved = env.get(key) ?? env.get(t.name)
      if (!resolved) return t
      return resolveInternalType(resolved, env, depth + 1)
    }
    case 'set':
      return { kind: 'set', element: resolveInternalType(t.element, env, depth + 1) }
    case 'seq':
      return { kind: 'seq', element: resolveInternalType(t.element, env, depth + 1) }
    case 'map':
      return {
        kind: 'map',
        domain: resolveInternalType(t.domain, env, depth + 1),
        range: resolveInternalType(t.range, env, depth + 1)
      }
    case 'product':
      return {
        kind: 'product',
        elements: t.elements.map((e) => resolveInternalType(e, env, depth + 1))
      }
    case 'composed':
      return {
        kind: 'composed',
        fields: t.fields.map((f) => ({
          name: f.name,
          type: resolveInternalType(f.type, env, depth + 1)
        }))
      }
    case 'union':
      return {
        kind: 'union',
        variants: t.variants.map((v) => resolveInternalType(v, env, depth + 1))
      }
    default:
      return t
  }
}

export function typesCompatible(a: InternalType, b: InternalType): boolean {
  if (a.kind === 'unknown' || b.kind === 'unknown') return true
  if (a.kind === 'basic' && b.kind === 'basic') {
    if (a.name === b.name) return true
    return numericSubtype(a, b)
  }
  if (a.kind !== b.kind) {
    if (a.kind === 'named' && b.kind === 'named') {
      return a.name === b.name && (a.module ?? '') === (b.module ?? '')
    }
    return false
  }
  switch (a.kind) {
    case 'basic':
      return a.name === (b as typeof a).name
    case 'named':
      return a.name === (b as typeof a).name && (a.module ?? '') === ((b as typeof a).module ?? '')
    case 'set':
      return typesCompatible(a.element, (b as typeof a).element)
    case 'seq':
      return typesCompatible(a.element, (b as typeof a).element)
    case 'map': {
      const bm = b as typeof a
      return typesCompatible(a.domain, bm.domain) && typesCompatible(a.range, bm.range)
    }
    case 'product': {
      const bp = b as typeof a
      if (a.elements.length !== bp.elements.length) return false
      return a.elements.every((e, i) => typesCompatible(e, bp.elements[i]))
    }
    case 'composed': {
      const bc = b as typeof a
      if (a.fields.length !== bc.fields.length) return false
      return a.fields.every(
        (f, i) => f.name === bc.fields[i].name && typesCompatible(f.type, bc.fields[i].type)
      )
    }
    case 'union': {
      const bu = b as typeof a
      if (a.variants.length === 0 || bu.variants.length === 0) return true
      return a.variants.some((va) => bu.variants.some((vb) => typesCompatible(va, vb)))
    }
    case 'enum':
      return JSON.stringify(a.values) === JSON.stringify((b as typeof a).values)
    default:
      return true
  }
}

/** Strict compatibility: unknown does not match anything. */
export function typesCompatibleStrict(a: InternalType, b: InternalType): boolean {
  if (a.kind === 'unknown' || b.kind === 'unknown') return false
  return typesCompatible(a, b)
}

export function unifyExprTypes(types: InternalType[]): InternalType {
  const known = types.filter((t) => t.kind !== 'unknown')
  if (known.length === 0) return { kind: 'unknown' }
  let result: InternalType = known[0]
  for (let i = 1; i < known.length; i++) {
    result = widenNumeric(result, known[i])
  }
  return result
}

function widenNumeric(a: InternalType, b: InternalType): InternalType {
  if (a.kind === 'basic' && b.kind === 'basic' && isNumericType(a) && isNumericType(b)) {
    const rank = Math.max(NUMERIC_RANK[a.name], NUMERIC_RANK[b.name])
    const name = (Object.keys(NUMERIC_RANK) as (keyof typeof NUMERIC_RANK)[]).find(
      (k) => NUMERIC_RANK[k] === rank
    )
    return { kind: 'basic', name: name ?? 'int' }
  }
  if (typesCompatible(a, b)) return b
  if (typesCompatible(b, a)) return a
  return { kind: 'unknown' }
}

export function typeToString(t: InternalType): string {
  switch (t.kind) {
    case 'basic':
      return t.name
    case 'named':
      return t.module ? `${t.module}.${t.name}` : t.name
    case 'set':
      return `set of ${typeToString(t.element)}`
    case 'seq':
      return `seq of ${typeToString(t.element)}`
    case 'map':
      return `map ${typeToString(t.domain)} to ${typeToString(t.range)}`
    case 'product':
      return t.elements.map(typeToString).join(' * ')
    case 'composed': {
      const fields = t.fields.map((f) => `${f.name}: ${typeToString(f.type)}`).join(' ')
      return `composed of ${fields} end`
    }
    case 'union':
      return t.variants.length === 0 ? '*' : t.variants.map(typeToString).join(' | ')
    case 'enum':
      return `{${t.values.map((v) => `<${v}>`).join(', ')}}`
    case 'unknown':
      return 'unknown'
    default:
      return 'unknown'
  }
}
