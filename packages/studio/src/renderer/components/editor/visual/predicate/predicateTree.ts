import type { AddNodeKind, PredicateUiNode } from './predicateTypes'

export type NodePath = number[]

export function nodeFromAddKind(kind: AddNodeKind): PredicateUiNode {
  switch (kind) {
    case 'literal-true':
      return { kind: 'literal', value: 'true' }
    case 'literal-false':
      return { kind: 'literal', value: 'false' }
    case 'expr':
      return { kind: 'expr', text: '' }
    case 'informal':
      return { kind: 'informal', text: 'informal requirement' }
    case 'relational':
      return { kind: 'relational', left: '', op: '=', right: '', text: '' }
    case 'quantified-forall':
      return { kind: 'quantified', quantifier: 'forall', bindings: 'x: nat', nested: [], body: { kind: 'literal', value: 'true' } }
    case 'quantified-exists':
      return { kind: 'quantified', quantifier: 'exists', bindings: 'x: nat', nested: [], body: { kind: 'literal', value: 'true' } }
    case 'and':
      return { kind: 'and', children: [{ kind: 'literal', value: 'true' }] }
    case 'or':
      return { kind: 'or', children: [{ kind: 'literal', value: 'true' }] }
  }
}

export function getAtPath(root: PredicateUiNode, path: NodePath): PredicateUiNode | null {
  let cur: PredicateUiNode = root
  for (const idx of path) {
    if (cur.kind === 'and' || cur.kind === 'or') {
      cur = cur.children[idx]!
    } else if (cur.kind === 'not') {
      cur = cur.child
    } else if (cur.kind === 'quantified') {
      cur = cur.body
    } else {
      return null
    }
  }
  return cur
}

export function parentPath(path: NodePath): NodePath {
  return path.slice(0, -1)
}

export function removeAtPath(root: PredicateUiNode, path: NodePath): PredicateUiNode | null {
  if (path.length === 0) return null
  const parent = getAtPath(root, parentPath(path))
  const idx = path[path.length - 1]!
  if (!parent || (parent.kind !== 'and' && parent.kind !== 'or')) return root
  parent.children.splice(idx, 1)
  if (parent.children.length === 0) {
    parent.children.push({ kind: 'literal', value: 'true' })
  }
  return root
}

export function addChildAtPath(root: PredicateUiNode, path: NodePath, child: PredicateUiNode): PredicateUiNode {
  const target = path.length ? getAtPath(root, path) : root
  if (!target) return root
  if (target.kind === 'and' || target.kind === 'or') {
    target.children.push(child)
    return root
  }
  if (path.length === 0) {
    return { kind: 'and', children: [root, child] }
  }
  return root
}

export function toggleAndOr(root: PredicateUiNode, path: NodePath): PredicateUiNode {
  const node = getAtPath(root, path)
  if (!node || (node.kind !== 'and' && node.kind !== 'or')) return root
  node.kind = node.kind === 'and' ? 'or' : 'and'
  return root
}

export function wrapNotAtPath(root: PredicateUiNode, path: NodePath): PredicateUiNode {
  const node = getAtPath(root, path)
  if (!node) return root
  const wrapped: PredicateUiNode = { kind: 'not', child: node }
  return replaceAtPath(root, path, wrapped)
}

export function unwrapNot(root: PredicateUiNode, path: NodePath): PredicateUiNode {
  const node = getAtPath(root, path)
  if (!node || node.kind !== 'not') return root
  return replaceAtPath(root, path, node.child)
}

function replaceAtPath(root: PredicateUiNode, path: NodePath, replacement: PredicateUiNode): PredicateUiNode {
  if (path.length === 0) return replacement
  const parent = getAtPath(root, parentPath(path))
  const idx = path[path.length - 1]!
  if (!parent) return root
  if (parent.kind === 'and' || parent.kind === 'or') {
    parent.children[idx] = replacement
  } else if (parent.kind === 'not') {
    parent.child = replacement
  } else if (parent.kind === 'quantified') {
    parent.body = replacement
  }
  return root
}

export function functionSignature(text: string): string {
  const idx = text.indexOf('==')
  return idx >= 0 ? text.slice(0, idx).trim() : text.trim()
}
