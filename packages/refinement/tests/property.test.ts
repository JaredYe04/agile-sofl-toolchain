import { describe, expect, it } from 'vitest'
import { RequirementGraph, deterministicIdGen, canTransition, toDocument, fromDocument, EventLog } from '../src/index.js'
import type { NodeStatus } from '../src/index.js'

/** Deterministic PRNG (mulberry32) — same as the harness, so property tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NODE_TYPES = ['goal', 'feature', 'process_ref', 'data_ref', 'constraint', 'user_story'] as const
const EDGE_KINDS = ['depends_on', 'constrains', 'conflicts_with', 'satisfies', 'traces_to'] as const
const STATUSES: NodeStatus[] = ['draft', 'needs_clarification', 'ready', 'deferred', 'blocked']

/** Apply a random legal mutation; returns false if the mutation was (correctly) rejected by an invariant. */
function randomOp(graph: RequirementGraph, rng: () => number): boolean {
  const nodes = graph.allNodes()
  const op = Math.floor(rng() * 5)
  try {
    if (op === 0 && nodes.length > 0) {
      // add a child under a random node.
      const parent = nodes[Math.floor(rng() * nodes.length)]
      graph.addNode({
        nodeType: NODE_TYPES[Math.floor(rng() * NODE_TYPES.length)],
        title: `n${nodes.length}`,
        description: 'd',
        scope: 's',
        parentId: parent.id,
        criticality: rng(),
        status: STATUSES[Math.floor(rng() * STATUSES.length)],
      })
      return true
    }
    if (op === 1 && nodes.length >= 2) {
      // add a cross-link (never refines, to avoid the one-parent rule) between two random nodes.
      const a = nodes[Math.floor(rng() * nodes.length)]
      const b = nodes[Math.floor(rng() * nodes.length)]
      if (a.id === b.id) return true
      graph.addEdge({ source: a.id, target: b.id, kind: EDGE_KINDS[Math.floor(rng() * EDGE_KINDS.length)] })
      return true
    }
    if (op === 2 && nodes.length > 1) {
      // move a non-root node under a random other node (cycle-guarded).
      const movable = nodes.filter((n) => n.parentId !== undefined)
      if (movable.length === 0) return true
      const from = movable[Math.floor(rng() * movable.length)]
      const to = nodes[Math.floor(rng() * nodes.length)]
      graph.move(from.id, to.id)
      return true
    }
    if (op === 3 && nodes.length > 1) {
      // soft-delete a random non-root node.
      const deletable = nodes.filter((n) => n.parentId !== undefined)
      if (deletable.length === 0) return true
      graph.softDelete(deletable[Math.floor(rng() * deletable.length)].id)
      return true
    }
    if (op === 4 && nodes.length > 0) {
      // a legal status transition on a random node.
      const n = nodes[Math.floor(rng() * nodes.length)]
      const targets = STATUSES.filter((s) => canTransition(n.status, s) && s !== n.status)
      if (targets.length === 0) return true
      n.status = targets[Math.floor(rng() * targets.length)]
      n.version += 1
      return true
    }
    return true
  } catch {
    // A rejected mutation (cycle / duplicate-parent / orphan) is expected behavior, not a failure.
    return false
  }
}

describe('property: random trees + cross-links + random ops keep invariants', () => {
  for (const seed of [1, 42, 999, 2024]) {
    it(`seed ${seed}: invariants hold across random ops`, () => {
      const graph = new RequirementGraph(deterministicIdGen())
      const rng = mulberry32(seed)
      // Seed a root.
      const root = graph.addNode({ nodeType: 'goal', title: 'root', description: 'd', scope: 's' })
      void root
      for (let i = 0; i < 400; i++) {
        randomOp(graph, rng)
        // Invariant 1: no refines cycle (validate catches it).
        const cycleErrors = graph.validate().filter((e) => e.code === 'CYCLE')
        expect(cycleErrors, `cycle after op ${i}`).toHaveLength(0)
        // Invariant 2: no duplicate refines parent.
        const dupErrors = graph.validate().filter((e) => e.code === 'DUPLICATE_PARENT')
        expect(dupErrors, `duplicate parent after op ${i}`).toHaveLength(0)
        // Invariant 5: every node has a version >= 1.
        for (const n of graph.allNodes()) expect(n.version, `version after op ${i}`).toBeGreaterThanOrEqual(1)
      }
      expect(graph.size()).toBeGreaterThan(0)
    })
  }

  it('serialization is consistent under random ops (round-trip preserves node count + invariants)', () => {
    const graph = new RequirementGraph(deterministicIdGen())
    const rng = mulberry32(7)
    graph.addNode({ nodeType: 'goal', title: 'root', description: 'd', scope: 's' })
    for (let i = 0; i < 200; i++) randomOp(graph, rng)
    const sizeBefore = graph.size()
    const doc = toDocument({ graph, obligations: [], decisions: [], events: new EventLog(() => 1) }, { docVersion: 1, now: () => 1 })
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1 })
    expect(loaded.graph.size()).toBe(sizeBefore)
    // No dangling edges should be introduced by the round-trip.
    const dangling = loaded.graph.validate().filter((e) => e.code === 'DANGLING_EDGE')
    expect(dangling).toHaveLength(0)
  })
})
