import { describe, expect, it } from 'vitest'
import { RequirementGraph, deterministicIdGen, computeImpactSet } from '../src/index.js'

/** Build a synthetic tree of `n` nodes (a spine with a few children each). Sizes are TEST PARAMETERS, not product SLOs. */
function buildTree(n: number): RequirementGraph {
  const graph = new RequirementGraph(deterministicIdGen())
  const root = graph.addNode({ nodeType: 'system_goal', title: 'root', description: 'd', scope: 's' })
  let parent = root.id
  for (let i = 1; i < n; i++) {
    const node = graph.addNode({ nodeType: 'feature', title: `n${i}`, description: 'd', scope: 's', parentId: parent })
    // Give some nodes a child so the tree is not a pure spine.
    if (i % 10 === 0) {
      graph.addNode({ nodeType: 'feature', title: `n${i}c`, description: 'd', scope: 's', parentId: node.id })
    }
    // Keep the spine: the next node always hangs off this one (a long chain to test deep traversal).
    parent = node.id
  }
  return graph
}

describe('performance: synthetic trees (test parameters, not SLOs)', () => {
  for (const n of [100, 1000, 10000]) {
    it(`builds a ${n}-node tree and answers queries in bounded time`, () => {
      const t0 = Date.now()
      const graph = buildTree(n)
      const buildMs = Date.now() - t0

      // Query: full traversal + invariant check.
      const t1 = Date.now()
      expect(graph.size()).toBeGreaterThanOrEqual(n)
      const errors = graph.validate()
      const queryMs = Date.now() - t1
      expect(errors).toHaveLength(0)

      // Change-impact: a single node's impact set (not a full recompute of the whole graph).
      const someNode = graph.allNodes()[Math.floor(n / 2)]
      const t2 = Date.now()
      const impact = computeImpactSet(graph, [someNode.id])
      const impactMs = Date.now() - t2
      expect(impact.length).toBeGreaterThanOrEqual(1)

      // Modify: a touch + a move (per-edit work stays small).
      const t3 = Date.now()
      graph.touch(someNode.id)
      const moveMs = Date.now() - t3

      // Sanity bounds: these must stay comfortably fast (generous; the point is no O(n^2) blowup).
      expect(buildMs).toBeLessThan(10000)
      expect(queryMs).toBeLessThan(5000)
      expect(impactMs).toBeLessThan(5000)
      expect(moveMs).toBeLessThan(1000)
    })
  }
})
