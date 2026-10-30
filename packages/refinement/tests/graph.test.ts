import { describe, expect, it } from 'vitest'
import { RequirementGraph, GraphError, deterministicIdGen } from '../src/index.js'

function g() {
  return new RequirementGraph(deterministicIdGen())
}

describe('RequirementGraph: CRUD', () => {
  it('adds a root node with defaults', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'system_goal', title: 'Goal', description: 'd', scope: 's' })
    expect(n.id).toBe('rn_d1')
    expect(n.version).toBe(1)
    expect(n.status).toBe('draft')
    expect(n.criticality).toBe(0.5)
    expect(n.source).toBe('AI_hypothesis')
    expect(graph.size()).toBe(1)
  })

  it('adds a child under a parent and creates a refines edge', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'Goal', description: 'd', scope: 's' })
    const child = graph.addNode({ nodeType: 'goal', title: 'Sub', description: 'd', scope: 's', parentId: root.id })
    expect(child.parentId).toBe(root.id)
    expect(graph.children(root.id).map((c) => c.id)).toContain(child.id)
    expect(graph.parent(child.id)?.id).toBe(root.id)
  })

  it('rejects adding a node under a non-existent parent (orphan prevention)', () => {
    const graph = g()
    expect(() => graph.addNode({ nodeType: 'goal', title: 'x', description: 'd', scope: 's', parentId: 'nope' })).toThrowError(GraphError)
  })

  it('generates unique ids across many nodes', () => {
    const graph = g()
    const ids = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const n = graph.addNode({ nodeType: 'goal', title: `t${i}`, description: 'd', scope: 's' })
      expect(ids.has(n.id)).toBe(false)
      ids.add(n.id)
    }
    expect(ids.size).toBe(500)
  })

  it('soft-deletes a node and re-parents its children', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
    const mid = graph.addNode({ nodeType: 'goal', title: 'M', description: 'd', scope: 's', parentId: root.id })
    const leaf = graph.addNode({ nodeType: 'feature', title: 'L', description: 'd', scope: 's', parentId: mid.id })
    const { reparented } = graph.softDelete(mid.id)
    expect(reparented).toEqual([leaf.id])
    expect(graph.getNode(mid.id)).toBeUndefined()
    expect(graph.parent(leaf.id)?.id).toBe(root.id) // child now under grandparent
  })

  it('touch bumps the version', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'x', description: 'd', scope: 's' })
    expect(graph.touch(n.id).version).toBe(2)
  })
})

describe('RequirementGraph: cycles & invariants', () => {
  it('prevents a refines cycle (child -> ancestor)', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', parentId: root.id })
    const b = graph.addNode({ nodeType: 'feature', title: 'B', description: 'd', scope: 's', parentId: a.id })
    // Adding b -> root as a refines edge would cycle root -> a -> b -> root.
    expect(() => graph.addEdge({ source: b.id, target: root.id, kind: 'refines' })).toThrowError(/cycle/i)
  })

  it('prevents a self-loop refines edge', () => {
    const graph = g()
    const n = graph.addNode({ nodeType: 'goal', title: 'x', description: 'd', scope: 's' })
    expect(() => graph.addEdge({ source: n.id, target: n.id, kind: 'refines' })).toThrowError(/cycle/i)
  })

  it('prevents a node having two refines parents', () => {
    const graph = g()
    const p1 = graph.addNode({ nodeType: 'goal', title: 'P1', description: 'd', scope: 's' })
    const p2 = graph.addNode({ nodeType: 'goal', title: 'P2', description: 'd', scope: 's' })
    const c = graph.addNode({ nodeType: 'feature', title: 'C', description: 'd', scope: 's', parentId: p1.id })
    expect(() => graph.addEdge({ source: p2.id, target: c.id, kind: 'refines' })).toThrowError(/parent/i)
  })

  it('allows non-refines cross-links (many-to-many) without cycle/duplicate-parent checks', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'constraint', title: 'C', description: 'd', scope: 's' })
    const b = graph.addNode({ nodeType: 'process_ref', title: 'P1', description: 'd', scope: 's' })
    const c = graph.addNode({ nodeType: 'process_ref', title: 'P2', description: 'd', scope: 's' })
    graph.addEdge({ source: a.id, target: b.id, kind: 'constrains' })
    graph.addEdge({ source: a.id, target: c.id, kind: 'constrains' })
    expect(graph.validate()).toHaveLength(0)
  })

  it('validate() returns empty for a well-formed tree', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
    graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', parentId: root.id })
    expect(graph.validate()).toHaveLength(0)
  })

  it('subtree returns the node and all descendants', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', parentId: root.id })
    graph.addNode({ nodeType: 'feature', title: 'B', description: 'd', scope: 's', parentId: a.id })
    expect(graph.subtree(a.id).map((n) => n.id)).toEqual([a.id, graph.children(a.id)[0].id])
    expect(graph.subtree(root.id)).toHaveLength(3)
  })
})

describe('RequirementGraph: move', () => {
  it('moves a subtree under a new parent and bumps its version', () => {
    const graph = g()
    const r1 = graph.addNode({ nodeType: 'goal', title: 'R1', description: 'd', scope: 's' })
    const r2 = graph.addNode({ nodeType: 'goal', title: 'R2', description: 'd', scope: 's' })
    const c = graph.addNode({ nodeType: 'feature', title: 'C', description: 'd', scope: 's', parentId: r1.id })
    const before = c.version
    graph.move(c.id, r2.id)
    expect(graph.parent(c.id)?.id).toBe(r2.id)
    expect(graph.parent(r1.id)).toBeUndefined()
    expect(c.version).toBe(before + 1)
  })

  it('refuses a move that would create a cycle', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's' })
    const b = graph.addNode({ nodeType: 'feature', title: 'B', description: 'd', scope: 's', parentId: a.id })
    expect(() => graph.move(a.id, b.id)).toThrowError(/cycle/i)
  })

  it('refuses a move to a non-existent parent', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's' })
    expect(() => graph.move(a.id, 'ghost')).toThrowError(GraphError)
  })
})

describe('RequirementGraph: cross-links & decomposition', () => {
  it('stores decomposition semantics on refines edges', () => {
    const graph = g()
    const p = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
    const c = graph.addNode({ nodeType: 'feature', title: 'C', description: 'd', scope: 's' })
    const edge = graph.addEdge({ source: p.id, target: c.id, kind: 'refines', decompositionSemantics: 'OR' })
    expect(edge.decompositionSemantics).toBe('OR')
    expect(graph.parent(c.id)?.id).toBe(p.id)
  })

  it('records conflicts_with for mutual exclusion', () => {
    const graph = g()
    const a = graph.addNode({ nodeType: 'constraint', title: 'A', description: 'd', scope: 's' })
    const b = graph.addNode({ nodeType: 'constraint', title: 'B', description: 'd', scope: 's' })
    graph.addEdge({ source: a.id, target: b.id, kind: 'conflicts_with', evidence: 'mutually exclusive' })
    expect(graph.validate()).toHaveLength(0)
  })
})

describe('RequirementGraph: serialization', () => {
  it('round-trips a tree to and from plain data preserving structure', () => {
    const graph = g()
    const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
    const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', parentId: root.id })
    graph.addNode({ nodeType: 'feature', title: 'B', description: 'd', scope: 's', parentId: a.id })
    const plain = graph.toPlain()
    const restored = RequirementGraph.fromPlain(plain, deterministicIdGen())
    expect(restored.size()).toBe(3)
    expect(restored.parent(restored.children(restored.getNode(root.id)!.id)[0].id)?.id).toBe(root.id)
    expect(restored.validate()).toHaveLength(0)
  })
})
