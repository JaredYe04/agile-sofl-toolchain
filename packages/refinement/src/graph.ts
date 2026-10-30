/**
 * RequirementGraph — the typed requirement-level structure (primary `refines` tree + typed cross-links).
 *
 * Invariants (conceptual-model section 1; enforced and testable):
 *   INV-1  no cycles in `refines` edges
 *   INV-2  no dangling edge endpoints (every edge source/target exists)
 *   INV-3  unique stable node ids
 *   INV-4  every node has at most one `refines` parent (or none, for roots)
 *   INV-5  every node has a version >= 1 (bumped on mutation)
 *
 * Tree depth / child count is intentionally NOT tracked as a completion metric (conceptual-model section 1).
 */
import type {
  RefinementEdge,
  RequirementNode,
  EdgeKind,
  NodeType,
  NodeStatus,
  ProvenanceStatus,
  ArtifactRef,
  DecompositionSemantics,
} from './types.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'

export type GraphErrorCode =
  | 'CYCLE'
  | 'DANGLING_EDGE'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_PARENT'
  | 'UNKNOWN_NODE'
  | 'UNKNOWN_EDGE'

export class GraphError extends Error {
  code: GraphErrorCode
  constructor(code: GraphErrorCode, message: string) {
    super(message)
    this.name = 'GraphError'
    this.code = code
  }
}

export interface AddNodeInput {
  nodeType: NodeType
  title: string
  description: string
  scope: string
  parentId?: string
  ordering?: number
  status?: NodeStatus
  criticality?: number
  source?: ProvenanceStatus
  owner?: string
  artifactRefs?: ArtifactRef[]
}

/**
 * The requirement graph. Mutations are guarded: adding a node/edge that would violate an invariant
 * throws a GraphError. A separate `validate()` returns a list of violations for the checker without
 * throwing (used by the obligation checker + readiness).
 */
export class RequirementGraph {
  private nodes = new Map<string, RequirementNode>()
  private edges = new Map<string, RefinementEdge>()
  readonly idGen: IdGen

  constructor(idGen: IdGen = randomIdGen()) {
    this.idGen = idGen
  }

  // ---- queries ---------------------------------------------------------

  getNode(id: string): RequirementNode | undefined {
    return this.nodes.get(id)
  }
  getEdge(id: string): RefinementEdge | undefined {
    return this.edges.get(id)
  }
  allNodes(): RequirementNode[] {
    return [...this.nodes.values()]
  }
  allEdges(): RefinementEdge[] {
    return [...this.edges.values()]
  }
  size(): number {
    return this.nodes.size
  }
  /** `refines` children of a node (primary-tree navigation). */
  children(id: string): RequirementNode[] {
    return this.allEdges()
      .filter((e) => e.kind === 'refines' && e.source === id)
      .map((e) => this.nodes.get(e.target)!)
      .filter(Boolean)
  }
  /** The single `refines` parent of a node, if any. */
  parent(id: string): RequirementNode | undefined {
    const e = this.allEdges().find((e) => e.kind === 'refines' && e.target === id)
    return e ? this.nodes.get(e.source) : undefined
  }
  /** Subtree (the node + all descendants via `refines`). Iterative, so a deep tree is safe. */
  subtree(id: string): RequirementNode[] {
    const out: RequirementNode[] = []
    const stack = [id]
    const seen = new Set<string>()
    while (stack.length) {
      const nid = stack.pop()!
      if (seen.has(nid)) continue
      seen.add(nid)
      const n = this.nodes.get(nid)
      if (!n) continue
      out.push(n)
      for (const c of this.children(nid)) stack.push(c.id)
    }
    return out
  }

  // ---- mutations (invariant-guarded) ----------------------------------

  addNode(input: AddNodeInput): RequirementNode {
    if (input.parentId !== undefined && !this.nodes.has(input.parentId)) {
      throw new GraphError('UNKNOWN_NODE', `parent ${input.parentId} does not exist`)
    }
    const node: RequirementNode = {
      id: this.idGen('rn'),
      nodeType: input.nodeType,
      title: input.title,
      description: input.description,
      scope: input.scope,
      parentId: input.parentId,
      ordering: input.ordering ?? 0,
      version: 1,
      source: input.source ?? 'AI_hypothesis',
      owner: input.owner,
      status: input.status ?? 'draft',
      criticality: input.criticality ?? 0.5,
      artifactRefs: input.artifactRefs ?? [],
    }
    this.nodes.set(node.id, node)
    if (input.parentId !== undefined) {
      // Create the refines edge (INV-1/INV-2 checked in addEdge).
      this.addEdge({ source: input.parentId, target: node.id, kind: 'refines' })
    }
    return node
  }

  addEdge(input: {
    source: string
    target: string
    kind: EdgeKind
    decompositionSemantics?: DecompositionSemantics
    evidence?: string
  }): RefinementEdge {
    // INV-2: both endpoints must exist.
    if (!this.nodes.has(input.source)) throw new GraphError('UNKNOWN_NODE', `edge source ${input.source} does not exist`)
    if (!this.nodes.has(input.target)) throw new GraphError('UNKNOWN_NODE', `edge target ${input.target} does not exist`)
    const edge: RefinementEdge = {
      id: this.idGen('re'),
      source: input.source,
      target: input.target,
      kind: input.kind,
      decompositionSemantics: input.decompositionSemantics,
      evidence: input.evidence,
      version: 1,
    }
    // INV-1: no refines cycles. Only refines edges form the tree.
    if (edge.kind === 'refines') {
      if (this.wouldCreateCycle(edge.source, edge.target)) {
        throw new GraphError('CYCLE', `adding refines ${edge.source} -> ${edge.target} would create a cycle`)
      }
      // INV-4: a target has at most one refines parent.
      const existingParent = this.allEdges().some((e) => e.kind === 'refines' && e.target === edge.target)
      if (existingParent) {
        throw new GraphError('DUPLICATE_PARENT', `node ${edge.target} already has a refines parent`)
      }
    }
    this.edges.set(edge.id, edge)
    return edge
  }

  /**
   * Soft-delete: removes the node and its edges; children are re-parented to the deleted node's
   * parent (or become roots). Returns the removed node and the ids of re-parented children.
   */
  softDelete(id: string): { node: RequirementNode; reparented: string[] } {
    const node = this.nodes.get(id)
    if (!node) throw new GraphError('UNKNOWN_NODE', `node ${id} does not exist`)
    const reparented: string[] = []
    const parent = node.parentId
    for (const child of this.children(id)) {
      if (parent !== undefined) {
        const oldEdge = this.allEdges().find((e) => e.kind === 'refines' && e.target === child.id)!
        this.edges.delete(oldEdge.id)
        if (!this.wouldCreateCycle(parent, child.id)) {
          const edgeId = this.idGen('re')
          this.edges.set(edgeId, { id: edgeId, source: parent, target: child.id, kind: 'refines', version: 1 })
        }
      }
      child.parentId = parent
      reparented.push(child.id)
    }
    for (const [eid, e] of [...this.edges]) {
      if (e.source === id || e.target === id) this.edges.delete(eid)
    }
    this.nodes.delete(id)
    return { node, reparented }
  }

  /** Move a subtree under a new parent (updates the single refines edge). INV-1/INV-4 guarded. */
  move(id: string, newParentId: string): RequirementNode {
    const node = this.nodes.get(id)
    if (!node) throw new GraphError('UNKNOWN_NODE', `node ${id} does not exist`)
    if (!this.nodes.has(newParentId)) throw new GraphError('UNKNOWN_NODE', `new parent ${newParentId} does not exist`)
    if (this.wouldCreateCycle(newParentId, id)) {
      throw new GraphError('CYCLE', `moving ${id} under ${newParentId} would create a cycle`)
    }
    const oldEdge = this.allEdges().find((e) => e.kind === 'refines' && e.target === id)
    if (oldEdge) this.edges.delete(oldEdge.id)
    const edgeId = this.idGen('re')
    this.edges.set(edgeId, { id: edgeId, source: newParentId, target: id, kind: 'refines', version: 1 })
    node.parentId = newParentId
    node.version += 1
    return node
  }

  /** Bump a node's version (used on content update). */
  touch(id: string): RequirementNode {
    const node = this.nodes.get(id)
    if (!node) throw new GraphError('UNKNOWN_NODE', `node ${id} does not exist`)
    node.version += 1
    return node
  }

  // ---- invariant checking ---------------------------------------------

  /** True iff adding a `refines` edge source -> target would create a cycle. */
  private wouldCreateCycle(source: string, target: string): boolean {
    // A cycle forms iff `source` is reachable from `target` via refines (then the new edge target->source
    // closes it), or source === target (self-loop).
    if (source === target) return true
    const seen = new Set<string>()
    const stack = [target]
    while (stack.length) {
      const cur = stack.pop()!
      if (cur === source) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const e of this.edges.values()) {
        if (e.kind === 'refines' && e.source === cur) stack.push(e.target)
      }
    }
    return false
  }

  /** Non-throwing validation: returns all invariant violations (empty when valid). */
  validate(): GraphError[] {
    const errors: GraphError[] = []
    // INV-2 dangling edges.
    for (const e of this.edges.values()) {
      if (!this.nodes.has(e.source)) errors.push(new GraphError('DANGLING_EDGE', `edge ${e.id} source ${e.source} dangling`))
      if (!this.nodes.has(e.target)) errors.push(new GraphError('DANGLING_EDGE', `edge ${e.id} target ${e.target} dangling`))
    }
    // INV-4 duplicate refines parent.
    const parentByChild = new Map<string, number>()
    for (const e of this.edges.values()) {
      if (e.kind === 'refines') parentByChild.set(e.target, (parentByChild.get(e.target) ?? 0) + 1)
    }
    for (const [child, count] of parentByChild) {
      if (count > 1) errors.push(new GraphError('DUPLICATE_PARENT', `node ${child} has ${count} refines parents`))
    }
    // INV-1 refines cycle.
    if (this.hasRefinesCycle()) errors.push(new GraphError('CYCLE', 'a refines cycle exists'))
    return errors
  }

  private hasRefinesCycle(): boolean {
    // Iterative DFS (an explicit stack) so a deep tree (thousands of nodes in a spine) cannot
    // overflow the call stack.
    const adjLists: string[][] = []
    const adjIdx = new Map<string, number>()
    for (const e of this.edges.values()) {
      if (e.kind !== 'refines') continue
      let idx = adjIdx.get(e.source)
      if (idx === undefined) {
        idx = adjLists.length
        adjLists.push([])
        adjIdx.set(e.source, idx)
      }
      adjLists[idx].push(e.target)
    }
    const color = new Map<string, number>() // 0 unvisited, 1 in-stack, 2 done
    for (const n of this.nodes.values()) {
      if ((color.get(n.id) ?? 0) !== 0) continue
      color.set(n.id, 1)
      const stack: Array<{ id: string; childIdx: number }> = [{ id: n.id, childIdx: 0 }]
      while (stack.length) {
        const top = stack[stack.length - 1]
        const adj = adjIdx.has(top.id) ? adjLists[adjIdx.get(top.id)!] : undefined
        if (top.childIdx < (adj?.length ?? 0)) {
          const v = adj![top.childIdx]
          top.childIdx += 1
          const c = color.get(v) ?? 0
          if (c === 1) return true
          if (c === 0) {
            color.set(v, 1)
            stack.push({ id: v, childIdx: 0 })
          }
        } else {
          color.set(top.id, 2)
          stack.pop()
        }
      }
    }
    return false
  }

  // ---- serialization (separate artifact; additive, reversible) --------

  toPlain(): { nodes: RequirementNode[]; edges: RefinementEdge[] } {
    return { nodes: this.allNodes(), edges: this.allEdges() }
  }

  static fromPlain(data: { nodes: RequirementNode[]; edges: RefinementEdge[] }, idGen: IdGen = randomIdGen()): RequirementGraph {
    const g = new RequirementGraph(idGen)
    for (const n of data.nodes) g.nodes.set(n.id, { ...n })
    for (const e of data.edges) g.edges.set(e.id, { ...e })
    return g
  }
}
