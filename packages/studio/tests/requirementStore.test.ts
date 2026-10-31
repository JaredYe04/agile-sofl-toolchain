import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RefinementSession, deterministicIdGen } from '@agile-sofl/refinement'
import {
  loadRequirementSession,
  saveRequirementSession,
  clearRequirementSession
} from '../src/main/services/llm/requirementStore'

/**
 * P4 — per-project persistence of the stateful `RefinementSession` (task book §6.1: "keep the agent
 * decoupled from the persistence model"). The agent loop is per-turn; this store serializes the
 * session to a per-project `requirement-graph.json` artifact and restores it. The requirement layer
 * is a SEPARATE, OPTIONAL artifact from the spec text: absence is a valid state (old projects still
 * open), and a corrupt artifact must degrade to an empty tree, not take the project down.
 */
const NOW = () => 1

function mkSession(): RefinementSession {
  return new RefinementSession({
    idGen: deterministicIdGen('rn'),
    obligationIdGen: deterministicIdGen('ob'),
    decisionIdGen: deterministicIdGen('dec'),
    readinessIdGen: deterministicIdGen('rdy'),
    now: NOW
  })
}

const tmpRoots: string[] = []
function tmpProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'req-store-'))
  tmpRoots.push(root)
  return root
}
afterEach(() => {
  while (tmpRoots.length) {
    const p = tmpRoots.pop()!
    try {
      rmSync(p, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

describe('requirementStore (per-project RefinementSession persistence)', () => {
  it('round-trips a populated session: save -> load reproduces the same snapshot', () => {
    const root = tmpProject()
    const s = mkSession()
    const r = s.graph.addNode({ nodeType: 'system_goal', title: 'Reserve a seat', description: 'd', scope: 'booking' })
    const [cap] = s.proposeRefinement(r.id, [{ nodeType: 'capability', title: 'Seat availability', description: 'd' }])
    const o = s.engine.open({ nodeId: cap, kind: 'policy_confirmation', description: 'confirm availability' })
    s.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })

    const wrote = saveRequirementSession(root, s)
    expect(wrote).toBe(true)
    expect(existsSync(join(root, '.agile-sofl', 'requirement-graph.json'))).toBe(true)

    const loaded = loadRequirementSession(root)
    expect(loaded.snapshot()).toEqual(s.snapshot())
    // The restored state behaves the same.
    expect(loaded.graph.getNode(cap)?.source).toBe('user_confirmed')
    expect(loaded.engine.get(o.id)?.status).toBe('satisfied')
    expect(loaded.docVersion).toBe(s.docVersion)
  })

  it('returns a fresh session when no artifact exists (the requirement layer is optional)', () => {
    const root = tmpProject()
    const loaded = loadRequirementSession(root)
    expect(loaded.snapshot().graph.nodes).toEqual([])
    expect(loaded.snapshot().obligations).toEqual([])
    expect(loaded.snapshot().docVersion).toBe(0)
  })

  it('does NOT create an artifact for an empty session (no spurious file)', () => {
    const root = tmpProject()
    const s = mkSession()
    expect(saveRequirementSession(root, s)).toBe(false)
    expect(existsSync(join(root, '.agile-sofl', 'requirement-graph.json'))).toBe(false)
  })

  it('degrades to an empty tree on a corrupt artifact (crash-recovery; does not throw)', () => {
    const root = tmpProject()
    const dir = join(root, '.agile-sofl')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'requirement-graph.json'), '{ this is not json', 'utf8')
    // loadRequirementSession must not throw on a corrupt file.
    const loaded = loadRequirementSession(root)
    expect(loaded.snapshot().graph.nodes).toEqual([])
  })

  it('a restored session can continue, and the continuation round-trips again', () => {
    const root = tmpProject()
    const s = mkSession()
    const r = s.graph.addNode({ nodeType: 'system_goal', title: 'X', description: 'd', scope: 'x' })
    const [cap] = s.proposeRefinement(r.id, [{ nodeType: 'capability', title: 'Y', description: 'd' }])
    saveRequirementSession(root, s)

    const loaded = loadRequirementSession(root)
    const o = loaded.engine.open({ nodeId: cap, kind: 'boundary_condition', description: 'confirm y bounds' })
    loaded.recordDecision({ obligationId: o.id, answer: { kind: 'confirm', answer: 'ok' }, actorKind: 'user' })
    saveRequirementSession(root, loaded)

    const reloaded = loadRequirementSession(root)
    expect(reloaded.snapshot()).toEqual(loaded.snapshot())
    expect(reloaded.engine.get(o.id)?.status).toBe('satisfied')
  })

  it('clearRequirementSession removes the artifact (best-effort)', () => {
    const root = tmpProject()
    const s = mkSession()
    const r = s.graph.addNode({ nodeType: 'system_goal', title: 'X', description: 'd', scope: 'x' })
    s.proposeRefinement(r.id, [{ nodeType: 'capability', title: 'Y', description: 'd' }])
    saveRequirementSession(root, s)
    expect(existsSync(join(root, '.agile-sofl', 'requirement-graph.json'))).toBe(true)
    clearRequirementSession(root)
    expect(existsSync(join(root, '.agile-sofl', 'requirement-graph.json'))).toBe(false)
  })
})
