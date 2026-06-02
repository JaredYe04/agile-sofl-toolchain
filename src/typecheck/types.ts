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

export function typesCompatible(a: InternalType, b: InternalType): boolean {
  if (a.kind === 'unknown' || b.kind === 'unknown') return true
  if (a.kind !== b.kind) {
    if (a.kind === 'basic' && b.kind === 'basic') return a.name === b.name
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
    case 'enum':
      return JSON.stringify(a.values) === JSON.stringify((b as typeof a).values)
    default:
      return true
  }
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
    case 'enum':
      return `{${t.values.map((v) => `<${v}>`).join(', ')}}`
    case 'unknown':
      return 'unknown'
    default:
      return 'unknown'
  }
}
