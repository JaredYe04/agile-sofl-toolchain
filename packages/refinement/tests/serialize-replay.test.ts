import { describe, expect, it } from 'vitest'
import {
  RequirementGraph,
  deterministicIdGen,
  ObligationEngine,
  DecisionStore,
  EventLog,
  ReadinessAssessor,
  toDocument,
  fromDocument,
  migrateToLatest,
  SCHEMA_VERSION,
  type RequirementState,
} from '../src/index.js'
import type { RequirementNode } from '../src/index.js'

const NOW = () => 1234567890

function buildState(): RequirementState {
  const graph = new RequirementGraph(deterministicIdGen())
  const root = graph.addNode({ nodeType: 'system_goal', title: '预订取消', description: '取消预订策略', scope: 'booking', criticality: 0.9 })
  const a = graph.addNode({ nodeType: 'goal', title: '退款窗口', description: 'd', scope: 'booking', parentId: root.id })
  const b = graph.addNode({ nodeType: 'feature', title: '退款计算', description: 'd', scope: 'booking', parentId: a.id })
  const p = graph.addNode({ nodeType: 'process_ref', title: 'Refund', description: 'd', scope: 'booking', parentId: b.id })
  graph.addNode({ nodeType: 'acceptance_scenario', title: '取消在窗口内', description: 'd', scope: 'booking', parentId: p.id })
  const data = graph.addNode({ nodeType: 'data_ref', title: '订单状态', description: 'd', scope: 'booking' })
  data.artifactRefs.push({ refKind: 'hybrid_type', refId: 'OrderState' })
  const c = graph.addNode({ nodeType: 'constraint', title: '库存一致', description: 'd', scope: 'booking' })
  graph.addEdge({ source: c.id, target: p.id, kind: 'constrains' })

  const engine = new ObligationEngine({ idGen: deterministicIdGen('ob'), now: NOW })
  engine.open({ nodeId: a.id, kind: 'policy_confirmation', description: '退款窗口高影响策略' })

  const decisions = new DecisionStore({ idGen: deterministicIdGen('dec'), now: NOW, events: undefined })
  decisions.record({ question: '窗口？', answer: '24小时', actorKind: 'user', provenance: 'user_confirmed', targetNodeIds: [a.id] })

  const events = new EventLog(NOW)
  events.append({ type: 'node_created', nodeId: root.id })
  events.append({ type: 'readiness_recomputed', scope: 'booking', verdict: 'NEEDS_CLARIFICATION' })

  return { graph, obligations: engine.all(), decisions: decisions.all(), events }
}

describe('serialization: round-trip', () => {
  it('round-trips a non-trivial graph + obligations + decisions + events', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 7, now: NOW })
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.docVersion).toBe(7)
    expect(doc.graph.nodes.length).toBe(7)

    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 7 })
    expect(loaded.graph.size()).toBe(7)
    expect(loaded.obligations).toHaveLength(1)
    expect(loaded.decisions).toHaveLength(1)
    expect(loaded.events.length).toBe(2)
    expect(loaded.graph.validate()).toHaveLength(0)
  })

  it('preserves non-ASCII (Chinese) content through a round-trip', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 1, now: NOW })
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1 })
    const node = loaded.graph.allNodes().find((n) => n.title === '预订取消')
    expect(node?.title).toBe('预订取消')
    expect(node?.description).toBe('取消预订策略')
    const decision = loaded.decisions[0]
    expect(decision.question).toBe('窗口？')
    expect(decision.answer).toBe('24小时')
  })

  it('round-trips an empty document (absence is a valid state)', () => {
    const empty: RequirementState = {
      graph: new RequirementGraph(deterministicIdGen()),
      obligations: [],
      decisions: [],
      events: new EventLog(NOW),
    }
    const doc = toDocument(empty, { docVersion: 0, now: NOW })
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 0 })
    expect(loaded.graph.size()).toBe(0)
    expect(loaded.graph.validate()).toHaveLength(0)
  })
})

describe('serialization: versioning & migration', () => {
  it('migrates a v0 (schema-less) document to the current schema additively', () => {
    const legacy = {
      // no schemaVersion; carries an unknown forward-compat key that must be preserved.
      docVersion: 3,
      savedAt: 1,
      graph: {
        nodes: [
          { id: 'n1', nodeType: 'goal', title: 'X', description: 'd', scope: 's', ordering: 0, version: 1, source: 'AI_hypothesis', status: 'draft', criticality: 0.5, artifactRefs: [] },
        ],
        edges: [],
      },
      obligations: [],
      decisions: [],
      events: [],
      customAnnotation: { owner: 'team-a' },
    }
    const migrated = migrateToLatest(legacy as never)
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.extensions?.customAnnotation).toEqual({ owner: 'team-a' })
    const loaded = fromDocument(migrated, { idGen: deterministicIdGen(), expectedDocVersion: 3 })
    expect(loaded.graph.getNode('n1')?.title).toBe('X')
  })

  it('rejects a document with a FUTURE schema version (no silent downgrade)', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 1, now: NOW })
    doc.schemaVersion = SCHEMA_VERSION + 5
    expect(() => fromDocument(doc, { idGen: deterministicIdGen() })).toThrowError(/newer|downgrade/i)
  })

  it('detects a version conflict (expected vs actual docVersion)', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 9, now: NOW })
    expect(() => fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 2 })).toThrowError(/version conflict/i)
  })
})

describe('serialization: crash recovery & corruption', () => {
  it('crashRecovery keeps well-formed records and drops corrupt ones', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 1, now: NOW })
    // Corrupt one node (drop required fields) and one edge.
    doc.graph.nodes[0] = { id: 'n_bad', title: 'broken' } as unknown as RequirementNode
    doc.graph.edges.push({ id: 'e_bad' } as never)
    expect(() => fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1 })).toThrowError(/corrupt/i)
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1, crashRecovery: true })
    // The corrupt node and edge are dropped; the rest survive.
    expect(loaded.graph.getNode('n_bad')).toBeUndefined()
    expect(loaded.graph.allEdges().some((e) => e.id === 'e_bad')).toBe(false)
    expect(loaded.graph.size()).toBeGreaterThan(0)
  })

  it('rejects a corrupt document by default (no crashRecovery)', () => {
    const state = buildState()
    const doc = toDocument(state, { docVersion: 1, now: NOW })
    doc.obligations.push({ id: 123 } as never)
    expect(() => fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1 })).toThrowError(/corrupt/i)
  })
})

describe('replay: deterministic identity + faithful event record', () => {
  it('the same operation sequence with the same deterministic id gen yields identical ids (replayable identity)', () => {
    const build = () => {
      const graph = new RequirementGraph(deterministicIdGen())
      const root = graph.addNode({ nodeType: 'system_goal', title: 'R', description: 'd', scope: 's' })
      const a = graph.addNode({ nodeType: 'goal', title: 'A', description: 'd', scope: 's', parentId: root.id })
      graph.addNode({ nodeType: 'feature', title: 'B', description: 'd', scope: 's', parentId: a.id })
      return graph.allNodes().map((n) => n.id)
    }
    expect(build()).toEqual(build()) // deterministic => replayable
  })

  it('the event record round-trips through the document and is deep-equal (faithful, dense-sequenced)', () => {
    const events = new EventLog(NOW)
    events.append({ type: 'node_created', nodeId: 'rn_d1' })
    events.append({ type: 'edge_added', edgeId: 're_d2' })
    events.append({ type: 'readiness_recomputed', scope: 'booking', verdict: 'NEEDS_CLARIFICATION' })

    const state = buildState()
    const doc = toDocument({ ...state, events }, { docVersion: 1, now: NOW })
    // Embed the hand-built event log into a document and round-trip it.
    const loaded = fromDocument(doc, { idGen: deterministicIdGen(), expectedDocVersion: 1 })
    expect(loaded.events.all().map((t) => t.event)).toEqual(doc.events.map((t) => t.event))
    expect(loaded.events.length).toBe(doc.events.length)
  })

  it('a non-dense event log is rejected on load (contract violation)', () => {
    const log = new EventLog(NOW)
    log.append({ type: 'node_created', nodeId: 'a' }) // seq 0
    log.append({ type: 'node_created', nodeId: 'b' }) // seq 1
    log.append({ type: 'node_created', nodeId: 'c' }) // seq 2
    // Corrupt the sequence: drop the middle event so the surviving seqs are no longer dense (0,2).
    const plain = log.toPlain().filter((t) => t.seq !== 1)
    expect(() => EventLog.fromPlain(plain)).toThrowError(/dense/i)
  })

  it('the same inputs yield the same readiness verdict and reason (deterministic)', () => {
    const assessor = new ReadinessAssessor(deterministicIdGen())
    const make = () => {
      const graph = new RequirementGraph(deterministicIdGen())
      const n = graph.addNode({ nodeType: 'goal', title: 'P', description: 'd', scope: 's' })
      const engine = new ObligationEngine({ idGen: deterministicIdGen('ob'), now: NOW })
      engine.open({ nodeId: n.id, kind: 'policy_confirmation', description: 'policy' })
      const decisions = new DecisionStore({ idGen: deterministicIdGen('dec'), now: NOW })
      return { graph, engine, decisions }
    }
    const a1 = assessor.assess({ ...make(), scope: { scope: 's', targetStage: 'impl' } })
    const a2 = assessor.assess({ ...make(), scope: { scope: 's', targetStage: 'impl' } })
    expect(a1.verdict).toBe(a2.verdict)
    expect(a1.reason).toBe(a2.reason)
  })
})
