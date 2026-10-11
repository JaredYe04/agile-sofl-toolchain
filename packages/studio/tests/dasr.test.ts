import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/dasr-electron', getAppPath: () => '/tmp/dasr-electron', isPackaged: false, getVersion: () => '0.0.0' },
  ipcMain: { handle: () => undefined, on: () => undefined, removeHandler: () => undefined }
}))
import { setActivePinia, createPinia } from 'pinia'
import {
  LABEL_NO_DECISIONS_REGISTERED,
  acknowledgeReview,
  applyDasrToolSurface,
  applyUpstreamChange,
  confirmDecision,
  decisionCompletion,
  decisionGateSkipped,
  emptyLedger,
  evaluateDecisionGate,
  formatDecisionDigest,
  gateAgentProposal,
  guardProjectWrite,
  impactForStoredPatch,
  readDecisionLedger,
  recordElementRead,
  registerDecision,
  registrationLabel,
  reopenDecision,
  resolveDasrMode,
  resolveProposalImpact,
  setDasrLogger,
  setLinkAcceptance,
  structuralApprovalSkipped,
  transitionDecision,
  writeDecisionLedger,
  type DecisionLedger
} from '../src/shared/dasr'
import { AGENT_TOOLS } from '../src/main/services/llm/skills'
import { applyHybridProposal } from '../scripts/agent-harness/core'
import { runB0Auto } from '../scripts/agent-harness/b0auto'
import { useDocumentStore } from '../src/renderer/stores/document'
import { useHistoryStore } from '../src/renderer/stores/history'
import { installDasrRuntime } from '../src/shared/dasr/runtime'

const logs: string[] = []

afterEach(() => {
  logs.length = 0
  delete process.env.AGILE_SOFL_DASR
})

function captureLogs(): void {
  setDasrLogger((line) => logs.push(line))
}

function project(): string {
  return mkdtempSync(join(tmpdir(), 'dasr-'))
}

function enableC2(root: string): void {
  mkdirSync(join(root, '.agile-sofl'), { recursive: true })
  writeFileSync(join(root, '.agile-sofl', 'experiment.json'), JSON.stringify({ condition: 'T', dasrMode: 'C2' }))
}

function tracked(question = 'Ship overnight or by ground?'): { ledger: DecisionLedger; id: string } {
  const created = registerDecision(emptyLedger(), {
    question,
    sourceRequirementIds: ['fn-ship'],
    elementIds: ['proc:Ship.Send'],
    provenance: 'human',
    acceptance: 'accepted',
    alternatives: [
      { id: 'air', label: 'Overnight air' },
      { id: 'ground', label: 'Ground' }
    ],
    now: '2026-10-11T00:00:00.000Z'
  })
  return { ledger: created.ledger, id: created.decision!.id }
}

function gate(ledger: DecisionLedger, impact: { kind: 'elements'; ids: string[] } | { kind: 'unknown' } | { kind: 'missing' }, commitment: 'confirmed' | 'provisional' | 'override' = 'confirmed', writePath = 'propose_hybrid_changes') {
  return evaluateDecisionGate({
    dasrEnabled: true,
    ledger,
    impact,
    commitment,
    writePath,
    now: '2026-10-11T00:01:00.000Z',
    override: commitment === 'override' ? { role: 'analyst', reason: 'Stakeholder accepted the risk in session.' } : undefined
  })
}

describe('DASR flag and labels', () => {
  it('defaults to C1 and turns on only for an explicit C2 flag', () => {
    expect(resolveDasrMode({ env: {} })).toMatchObject({ enabled: false, mode: 'C1', source: 'default' })
    expect(resolveDasrMode({ env: { AGILE_SOFL_DASR: '1' } }).mode).toBe('C2')
    expect(resolveDasrMode({ env: {}, file: { dasrMode: 'C2' } })).toMatchObject({ enabled: true, mode: 'C2', source: 'file' })
    expect(resolveDasrMode({ env: { AGILE_SOFL_DASR: '0' }, file: { dasr: true } }).mode).toBe('C1')
  })

  it('auto-write skips structural approval and does not skip the decision gate', () => {
    expect(structuralApprovalSkipped('auto')).toBe(true)
    expect(structuralApprovalSkipped('ask')).toBe(false)
    expect(decisionGateSkipped('auto')).toBe(false)
    expect(decisionGateSkipped('ask')).toBe(false)
  })

  it('an empty ledger says no decisions registered', () => {
    expect(registrationLabel(emptyLedger())).toBe(LABEL_NO_DECISIONS_REGISTERED)
    expect(registrationLabel(emptyLedger())).toBe('no decisions registered')
    expect(registrationLabel(emptyLedger())).not.toBe('no unresolved decisions')
    expect(formatDecisionDigest(emptyLedger())).not.toMatch(/ambiguity/i)
    expect(decisionCompletion(emptyLedger())).toMatchObject({
      registrationLabel: 'no decisions registered',
      unresolvedCount: 0,
      allTrackedConfirmed: false,
      semanticCorrectness: false,
      refinementObligationsClosed: null
    })
  })
})

describe('P1 no silent commitment', () => {
  it('blocks a confirmed write of an element linked to an unresolved decision', () => {
    captureLogs()
    const { ledger, id } = tracked()
    const result = gate(ledger, { kind: 'elements', ids: ['proc:Ship.Send'] })
    expect(result.allow).toBe(false)
    expect(result.disposition).toBe('blocked')
    expect(result.decisionIds).toContain(id)
    expect(result.error).toMatch(/Confirmed write blocked/)
    expect(result.ledger.audit.some((event) => event.kind === 'write-blocked' && event.decisionId === id)).toBe(true)
    expect(logs.some((line) => line.includes('write-blocked') && line.includes(id))).toBe(true)
  })

  it('allows a confirmed write whose declared targets do not intersect that decision', () => {
    const { ledger } = tracked()
    const result = gate(ledger, { kind: 'elements', ids: ['proc:Ship.Unrelated'] }, 'confirmed', 'propose_changes')
    expect(result.allow).toBe(true)
    expect(result.disposition).toBe('allowed')
    expect(result.ledger.elements.find((el) => el.elementId === 'proc:Ship.Unrelated')?.commitment).toBe('confirmed')
  })

  it('stores a provisional write explicitly and does not call it a confirmed specification', () => {
    const { ledger, id } = tracked()
    const result = gate(ledger, { kind: 'elements', ids: ['proc:Ship.Send'] }, 'provisional', 'propose_hybrid_changes')
    expect(result.allow).toBe(true)
    expect(result.disposition).toBe('provisional')
    const row = result.ledger.elements.find((el) => el.elementId === 'proc:Ship.Send')
    expect(row?.commitment).toBe('provisional')
    const digest = formatDecisionDigest(result.ledger)
    expect(digest).toContain('PROVISIONAL')
    expect(digest).toContain('not a confirmed specification')
    expect(digest).not.toMatch(/ambiguity/i)
    expect(result.ledger.decisions.find((d) => d.id === id)?.status).toBe('unresolved')
  })

  it('fails closed when targets are missing, unknown, or an empty list', () => {
    const { ledger } = tracked()
    for (const impact of [{ kind: 'missing' as const }, { kind: 'unknown' as const }, { kind: 'elements' as const, ids: [] }]) {
      const result = gate(ledger, impact)
      expect(result.allow).toBe(false)
      expect(result.error).toMatch(/fails closed|not evidence of no impact|missing or unknown/)
    }
    const empty = gate(emptyLedger(), { kind: 'unknown' })
    expect(empty.allow).toBe(false)
    expect(registrationLabel(empty.ledger)).toBe('no decisions registered')
  })

  it('does not treat a decision with no links as unrelated', () => {
    const created = registerDecision(emptyLedger(), { question: 'Which tax rule?', now: '2026-10-11T00:00:00.000Z' })
    const result = gate(created.ledger, { kind: 'elements', ids: ['proc:Tax.Other'] })
    expect(result.allow).toBe(false)
    expect(result.error).toMatch(/scope is unknown/)
  })

  it('C1 does not apply the gate', () => {
    const { ledger } = tracked()
    const result = evaluateDecisionGate({
      dasrEnabled: false,
      ledger,
      impact: { kind: 'unknown' },
      commitment: 'confirmed',
      writePath: 'auto-write'
    })
    expect(result.allow).toBe(true)
    expect(result.disposition).toBe('skipped-dasr-off')
    expect(result.ledger).toBe(ledger)
  })
})

describe('P2 traceability of commitment', () => {
  it('records the confirming act and then allows the linked write', () => {
    captureLogs()
    const { ledger, id } = tracked()
    const confirmed = confirmDecision(ledger, {
      id,
      actorRole: 'analyst',
      evidence: 'Chose ground in the review meeting.',
      selectedAlternativeId: 'ground',
      now: '2026-10-11T00:02:00.000Z'
    })
    expect(confirmed.error).toBeUndefined()
    const decision = confirmed.ledger.decisions.find((d) => d.id === id)!
    expect(decision.status).toBe('confirmed')
    expect(decision.confirmedBy).toBe('analyst')
    expect(decision.selectedAlternativeId).toBe('ground')
    const transition = confirmed.ledger.audit.find((event) => event.kind === 'status-transition' && event.decisionId === id)
    expect(transition).toMatchObject({ fromStatus: 'unresolved', toStatus: 'confirmed', actorRole: 'analyst' })
    expect(logs.some((line) => line.includes('status-transition') && line.includes('unresolved -> confirmed'))).toBe(true)
    const write = gate(confirmed.ledger, { kind: 'elements', ids: ['proc:Ship.Send'] })
    expect(write.allow).toBe(true)
    expect(write.decisionIds).toContain(id)
    expect(write.ledger.audit.some((event) => event.kind === 'write-allowed' && event.decisionId === id && event.elementIds.includes('proc:Ship.Send'))).toBe(true)
  })

  it('does not record a confirmation when the write was blocked or the model asks to confirm', () => {
    const { ledger, id } = tracked()
    const blocked = gate(ledger, { kind: 'elements', ids: ['proc:Ship.Send'] })
    expect(blocked.ledger.decisions.find((d) => d.id === id)?.status).toBe('unresolved')
    expect(blocked.ledger.audit.some((event) => event.toStatus === 'confirmed')).toBe(false)
    const forged = transitionDecision(ledger, { id, to: 'confirmed', now: '2026-10-11T00:02:00.000Z' })
    expect(forged.error).toMatch(/actor role/)
    expect(forged.ledger.decisions.find((d) => d.id === id)?.status).toBe('unresolved')
  })
})

describe('P3 impact invalidation', () => {
  it('marks only the linked elements stale and supersedes that decision into a successor', () => {
    captureLogs()
    const { ledger, id } = tracked()
    const confirmed = confirmDecision(ledger, {
      id,
      actorRole: 'analyst',
      selectedAlternativeId: 'ground',
      now: '2026-10-11T00:02:00.000Z'
    })
    const other = registerDecision(confirmed.ledger, {
      id: 'dec-other',
      question: 'Show prices with tax?',
      sourceRequirementIds: ['fn-price'],
      elementIds: ['proc:Price.Show'],
      provenance: 'human',
      acceptance: 'accepted',
      now: '2026-10-11T00:03:00.000Z'
    })
    const otherConfirmed = confirmDecision(other.ledger, {
      id: 'dec-other',
      actorRole: 'analyst',
      now: '2026-10-11T00:03:30.000Z'
    })
    const changed = applyUpstreamChange(otherConfirmed.ledger, {
      requirementId: 'fn-ship',
      actorRole: 'analyst',
      now: '2026-10-11T00:04:00.000Z'
    })
    const predecessor = changed.ledger.decisions.find((d) => d.id === id)!
    expect(predecessor.status).toBe('superseded')
    expect(predecessor.selectedAlternativeId).toBe('ground')
    expect(predecessor.supersededBy).toBeTruthy()
    const successor = changed.ledger.decisions.find((d) => d.id === predecessor.supersededBy)!
    expect(successor.status).toBe('unresolved')
    expect(successor.successorOf).toBe(id)
    expect(changed.ledger.decisions.find((d) => d.id === 'dec-other')?.status).toBe('confirmed')
    const ship = changed.ledger.elements.find((el) => el.elementId === 'proc:Ship.Send')!
    expect(ship.reviewMarks).toEqual(expect.arrayContaining(['stale', 'needs-review']))
    expect(changed.ledger.elements.find((el) => el.elementId === 'proc:Price.Show')).toBeUndefined()
    expect(logs.some((line) => line.includes('status-transition') && line.includes('confirmed -> superseded'))).toBe(true)
    const read = recordElementRead(changed.ledger, { elementId: 'proc:Ship.Send', now: '2026-10-11T00:05:00.000Z' })
    expect(read.elements.find((el) => el.elementId === 'proc:Ship.Send')?.reviewMarks).toEqual(ship.reviewMarks)
    const cleared = acknowledgeReview(read, { elementId: 'proc:Ship.Send', actorRole: 'analyst', now: '2026-10-11T00:06:00.000Z' })
    expect(cleared.ledger.elements.find((el) => el.elementId === 'proc:Ship.Send')?.reviewMarks).toEqual([])
  })

  it('refuses to reopen by writing unresolved over a confirmed decision', () => {
    const { ledger, id } = tracked()
    const confirmed = confirmDecision(ledger, { id, actorRole: 'analyst', selectedAlternativeId: 'air', now: '2026-10-11T00:02:00.000Z' })
    const illegal = transitionDecision(confirmed.ledger, { id, to: 'unresolved' })
    expect(illegal.error).toMatch(/successor/)
    expect(illegal.ledger.decisions.find((d) => d.id === id)?.status).toBe('confirmed')
    const reopened = reopenDecision(confirmed.ledger, { id, actorRole: 'analyst', now: '2026-10-11T00:03:00.000Z' })
    expect(reopened.successor?.status).toBe('unresolved')
    expect(reopened.ledger.decisions.find((d) => d.id === id)?.status).toBe('superseded')
  })
})

describe('P4 decision completion is not refinement completion', () => {
  it('a fully confirmed ledger is still not semantic correctness', () => {
    const { ledger, id } = tracked()
    const confirmed = confirmDecision(ledger, { id, actorRole: 'analyst', selectedAlternativeId: 'air', now: '2026-10-11T00:02:00.000Z' })
    const completion = decisionCompletion(confirmed.ledger)
    expect(completion.allTrackedConfirmed).toBe(true)
    expect(completion.semanticCorrectness).toBe(false)
    expect(completion.refinementObligationsClosed).toBeNull()
    expect(formatDecisionDigest(confirmed.ledger)).not.toMatch(/ambiguity/i)
    expect(completion.registrationLabel).not.toBe('no decisions registered')
  })

  it('zero unresolved decisions on an empty ledger is not decision completion', () => {
    const completion = decisionCompletion(emptyLedger())
    expect(completion.unresolvedCount).toBe(0)
    expect(completion.allTrackedConfirmed).toBe(false)
    expect(completion.registrationLabel).toBe('no decisions registered')
  })
})

describe('impact link provenance and acceptance', () => {
  it('a proposed link still blocks, and a withdrawn link does not', () => {
    const created = registerDecision(emptyLedger(), {
      question: 'Which carrier?',
      elementIds: ['proc:Ship.Send', 'proc:Ship.Other'],
      provenance: 'model',
      acceptance: 'proposed',
      now: '2026-10-11T00:00:00.000Z'
    })
    const links = created.ledger.links
    expect(links.every((link) => link.provenance === 'model' && link.acceptance === 'proposed')).toBe(true)
    expect(gate(created.ledger, { kind: 'elements', ids: ['proc:Ship.Send'] }).allow).toBe(false)
    const withdrawn = setLinkAcceptance(created.ledger, {
      linkId: links.find((link) => link.elementId === 'proc:Ship.Other')!.id,
      acceptance: 'withdrawn',
      actorRole: 'analyst',
      now: '2026-10-11T00:01:00.000Z'
    })
    expect(withdrawn.ledger.links.find((link) => link.elementId === 'proc:Ship.Other')?.acceptance).toBe('withdrawn')
    expect(gate(withdrawn.ledger, { kind: 'elements', ids: ['proc:Ship.Other'] }).allow).toBe(true)
    expect(gate(withdrawn.ledger, { kind: 'elements', ids: ['proc:Ship.Send'] }).allow).toBe(false)
    const accepted = setLinkAcceptance(withdrawn.ledger, {
      linkId: links.find((link) => link.elementId === 'proc:Ship.Send')!.id,
      acceptance: 'accepted',
      actorRole: 'analyst'
    })
    expect(accepted.ledger.links.find((link) => link.elementId === 'proc:Ship.Send')).toMatchObject({
      acceptance: 'accepted',
      provenance: 'model'
    })
  })
})

describe('override and automatic mode', () => {
  it('blocks override while automatic mode is on, even with a role and a reason', () => {
    const { ledger } = tracked()
    const result = evaluateDecisionGate({
      dasrEnabled: true,
      ledger,
      impact: { kind: 'elements', ids: ['proc:Ship.Send'] },
      commitment: 'override',
      writePath: 'auto-write',
      automaticMode: true,
      override: { role: 'analyst', reason: 'Stakeholder accepted the risk in session.' },
      now: '2026-10-11T00:01:00.000Z'
    })
    expect(result.allow).toBe(false)
    expect(result.disposition).toBe('blocked')
    expect(result.error).toMatch(/automatic mode|auto-approve/)
    const root = project()
    enableC2(root)
    writeDecisionLedger(root, ledger)
    const harness = guardProjectWrite(root, {
      writePath: 'harness-auto-accept',
      impact: { kind: 'elements', ids: ['proc:Ship.Send'] },
      commitment: 'override',
      automaticMode: true,
      override: { role: 'analyst', reason: 'Stakeholder accepted the risk in session.' }
    })
    expect(harness.allow).toBe(false)
  })

  it('allows a human override with role and reason when automatic mode is off', () => {
    const { ledger, id } = tracked()
    const result = gate(ledger, { kind: 'elements', ids: ['proc:Ship.Send'] }, 'override', 'propose_hybrid_changes')
    expect(result.allow).toBe(true)
    expect(result.disposition).toBe('override')
    expect(result.decisionIds).toContain(id)
    expect(result.ledger.elements.find((el) => el.elementId === 'proc:Ship.Send')?.commitment).toBe('override')
    expect(result.ledger.audit.some((event) => event.kind === 'write-override' && event.actorRole === 'analyst')).toBe(true)
  })
})

describe('write paths cannot bypass the gate', () => {
  it('source edit and GUI edits stay unknown even if the caller names an unrelated id', () => {
    const source = resolveProposalImpact({
      operations: [{ op: 'replace-document', text: 'module SYSTEM_X;\nend_module\n' }],
      impactElementIds: ['proc:Ship.Unrelated']
    })
    expect(source.kind).toBe('unknown')
    const gui = resolveProposalImpact({
      operations: [{ op: 'replace', oldText: '<button>', newText: '<button disabled>' }],
      impactElementIds: ['gui:home']
    })
    expect(gui.kind).toBe('unknown')
    const { ledger } = tracked()
    expect(gate(ledger, source, 'confirmed', 'propose_source_edit').allow).toBe(false)
    expect(gate(ledger, gui, 'confirmed', 'propose_gui_changes').allow).toBe(false)
    expect(gate(ledger, { kind: 'unknown' }, 'confirmed', 'auto-write').allow).toBe(false)
  })

  it('a named GUI screen and a named informal id are gated, not skipped', () => {
    const { ledger } = tracked()
    const gui = resolveProposalImpact({ operations: [{ op: 'replace-screen-html', screenId: 'home' }] })
    expect(gui).toEqual({ kind: 'elements', ids: ['gui:home'] })
    expect(gate(ledger, gui, 'confirmed', 'propose_gui_changes').allow).toBe(true)
    const hit = registerDecision(ledger, {
      question: 'Which home screen?',
      elementIds: ['gui:home'],
      provenance: 'human',
      acceptance: 'accepted'
    })
    expect(gate(hit.ledger, { kind: 'elements', ids: ['gui:home'] }, 'confirmed', 'propose_gui_changes').allow).toBe(false)
  })

  it('the model cannot grant itself an override', () => {
    const root = project()
    enableC2(root)
    const { ledger, id } = tracked()
    writeDecisionLedger(root, ledger)
    const result = gateAgentProposal(root, {
      tool: 'propose_source_edit',
      proposalId: 'call-1',
      operations: [{ op: 'replace-document', text: 'module SYSTEM_X;\nend_module\n' }],
      args: { commitment: 'override', override: { role: 'analyst', reason: 'trust me' }, impactElementIds: ['proc:Ship.Unrelated'] }
    })
    expect(result.allow).toBe(false)
    expect(readDecisionLedger(root).decisions.find((d) => d.id === id)?.status).toBe('unresolved')
  })

  it('C2 exposes decision tools and C1 keeps the existing tool list', () => {
    const c1 = applyDasrToolSurface(AGENT_TOOLS, false).map((tool) => tool.function.name)
    const c2 = applyDasrToolSurface(AGENT_TOOLS, true).map((tool) => tool.function.name)
    expect(c1).toEqual(AGENT_TOOLS.map((tool) => tool.function.name))
    expect(c2).toContain('list_decisions')
    expect(c2).toContain('register_decision')
    expect(c2).not.toContain('confirm_decision')
    const propose = c2.includes('propose_changes')
    expect(propose).toBe(true)
    const c2Propose = applyDasrToolSurface(AGENT_TOOLS, true).find((tool) => tool.function.name === 'propose_changes')
    expect(c2Propose?.function.parameters.properties).toHaveProperty('impactElementIds')
    const c1Propose = applyDasrToolSurface(AGENT_TOOLS, false).find((tool) => tool.function.name === 'propose_changes')
    expect(c1Propose?.function.parameters.properties).not.toHaveProperty('impactElementIds')
  })
})

describe('ledger reload, migration, and old projects', () => {
  it('reloads decisions, links, and audit after a new session reads the file', () => {
    const root = project()
    const { ledger, id } = tracked()
    const confirmed = confirmDecision(ledger, { id, actorRole: 'analyst', selectedAlternativeId: 'ground', now: '2026-10-11T00:02:00.000Z' })
    writeDecisionLedger(root, confirmed.ledger)
    const loaded = readDecisionLedger(root)
    expect(loaded.decisions.map((d) => d.id)).toEqual(confirmed.ledger.decisions.map((d) => d.id))
    expect(loaded.links.map((l) => l.elementId)).toEqual(['proc:Ship.Send'])
    expect(loaded.audit.map((event) => event.kind)).toEqual(confirmed.ledger.audit.map((event) => event.kind))
    expect(loaded.decisions[0]?.status).toBe('confirmed')
  })

  it('migrates a legacy affectedElementIds list without dropping the decision or other project files', () => {
    const root = project()
    mkdirSync(join(root, '.agile-sofl', 'agent', 'sessions'), { recursive: true })
    const aspec = '# Functions\n\n## Ship\n\nSend the parcel.\n'
    const asfl = 'module SYSTEM_Ship;\nend_module\n'
    const meta = '{"title":"Ship"}\n'
    const session = '{"id":"s1"}\n'
    const refinement = '{"kind":"FormalizePredicate"}\n'
    writeFileSync(join(root, 'informal.aspec'), aspec)
    writeFileSync(join(root, 'hybrid.asfl'), asfl)
    writeFileSync(join(root, '.agile-sofl', 'informal-meta.json'), meta)
    writeFileSync(join(root, '.agile-sofl', 'agent', 'sessions', 's1.json'), session)
    writeFileSync(join(root, '.agile-sofl', 'refinement-log.jsonl'), refinement)
    const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
    const before = [aspec, asfl, meta, session, refinement].map((_, i) => i)
    const paths = [
      join(root, 'informal.aspec'),
      join(root, 'hybrid.asfl'),
      join(root, '.agile-sofl', 'informal-meta.json'),
      join(root, '.agile-sofl', 'agent', 'sessions', 's1.json'),
      join(root, '.agile-sofl', 'refinement-log.jsonl')
    ]
    const hashes = paths.map(hash)
    expect(existsSync(join(root, '.agile-sofl', 'decision-ledger.json'))).toBe(false)
    expect(registrationLabel(readDecisionLedger(root))).toBe('no decisions registered')
    expect(paths.map(hash)).toEqual(hashes)
    writeFileSync(
      join(root, '.agile-sofl', 'decision-ledger.json'),
      JSON.stringify({
        note: 'legacy-note',
        decisions: [
          {
            id: 'd-old',
            question: 'Air or ground?',
            sourceRequirementIds: ['fn-ship'],
            status: 'unresolved',
            affectedElementIds: ['proc:Ship.Send']
          }
        ]
      })
    )
    const migrated = readDecisionLedger(root)
    expect(migrated.decisions[0]).toMatchObject({ id: 'd-old', question: 'Air or ground?', status: 'unresolved', revision: 1 })
    expect(migrated.links[0]).toMatchObject({ elementId: 'proc:Ship.Send', provenance: 'import', acceptance: 'proposed' })
    expect(migrated.preserved).toMatchObject({ note: 'legacy-note' })
    expect(registrationLabel(migrated)).toBe('1 unresolved decision')
    expect(paths.map(hash)).toEqual(hashes)
    expect(before.length).toBe(5)
    const garbage = '{ "decisions": "nope" }\n'
    writeFileSync(join(root, '.agile-sofl', 'decision-ledger.json'), garbage)
    const broken = readDecisionLedger(root)
    expect(broken.registration).toBe('unreadable')
    expect(registrationLabel(broken)).not.toBe('no decisions registered')
    expect(registrationLabel(broken)).not.toBe('no unresolved decisions')
    const refused = guardProjectWrite(root, { writePath: 'propose_changes', impact: { kind: 'elements', ids: ['fn-ship'] } })
    expect(refused.allow).toBe(false)
    expect(readFileSync(join(root, '.agile-sofl', 'decision-ledger.json'), 'utf8')).toBe(garbage)
    expect(paths.map(hash)).toEqual(hashes)
  })

  it('loads a stored rejected link as withdrawn and keeps rejected as a decision status', () => {
    const root = project()
    mkdirSync(join(root, '.agile-sofl'), { recursive: true })
    writeFileSync(
      join(root, '.agile-sofl', 'decision-ledger.json'),
      JSON.stringify({
        decisions: [{ id: 'd1', question: 'Air or ground?', status: 'rejected' }],
        links: [
          {
            id: 'l1',
            decisionId: 'd1',
            elementId: 'proc:Ship.Send',
            provenance: 'human',
            acceptance: 'rejected'
          }
        ],
        audit: [{ id: 'a1', at: '2026-10-11T00:00:00.000Z', kind: 'impact-rejected', elementIds: ['proc:Ship.Send'], note: 'old' }]
      })
    )
    const loaded = readDecisionLedger(root)
    expect(loaded.decisions[0]?.status).toBe('rejected')
    expect(loaded.links[0]?.acceptance).toBe('withdrawn')
    expect(loaded.audit[0]?.kind).toBe('impact-withdrawn')
    expect(loaded.links[0]?.acceptance).not.toBe('rejected')
  })
})

describe('end-to-end decision gate on apply paths', () => {
  it('walks record, block, provisional, confirm, commit, change, reload', () => {
    captureLogs()
    const root = project()
    enableC2(root)
    const created = registerDecision(emptyLedger(), {
      question: 'Ship overnight or by ground?',
      sourceRequirementIds: ['fn-ship'],
      elementIds: ['proc:Ship.Send'],
      provenance: 'human',
      acceptance: 'accepted',
      alternatives: [
        { id: 'air', label: 'Overnight air' },
        { id: 'ground', label: 'Ground' }
      ],
      now: '2026-10-11T00:00:00.000Z'
    })
    writeDecisionLedger(root, created.ledger)
    const source = 'module SYSTEM_Ship;\nprocess Send\nend_process\nend_module\n'
    const blocked = applyHybridProposal(
      source,
      {
        target: 'hybrid',
        mode: 'source',
        operations: [{ op: 'replace-document', text: 'module SYSTEM_Ship;\nprocess SendOvernight\nend_process\nend_module\n' }]
      },
      root
    )
    expect(blocked.applied).toBe(false)
    expect(blocked.content).toBe(source)
    expect(blocked.error).toMatch(/missing or unknown/)
    const unrelated = guardProjectWrite(root, {
      writePath: 'propose_hybrid_changes',
      impact: { kind: 'elements', ids: ['proc:Ship.Quote'] },
      commitment: 'confirmed'
    })
    expect(unrelated.allow).toBe(true)
    const provisional = guardProjectWrite(root, {
      writePath: 'propose_hybrid_changes',
      impact: { kind: 'elements', ids: ['proc:Ship.Send'] },
      commitment: 'provisional'
    })
    expect(provisional.allow).toBe(true)
    expect(formatDecisionDigest(provisional.ledger)).toContain('PROVISIONAL')
    writeDecisionLedger(root, provisional.ledger)
    const id = created.decision!.id
    const confirmed = confirmDecision(readDecisionLedger(root), {
      id,
      actorRole: 'analyst',
      selectedAlternativeId: 'ground',
      evidence: 'Customer picked ground.',
      now: '2026-10-11T00:02:00.000Z'
    })
    writeDecisionLedger(root, confirmed.ledger)
    const allowed = guardProjectWrite(root, {
      writePath: 'propose_hybrid_changes',
      impact: { kind: 'elements', ids: ['proc:Ship.Send'] },
      commitment: 'confirmed'
    })
    expect(allowed.allow).toBe(true)
    expect(allowed.decisionIds).toContain(id)
    const changed = applyUpstreamChange(allowed.ledger, { requirementId: 'fn-ship', actorRole: 'analyst', now: '2026-10-11T00:03:00.000Z' })
    writeDecisionLedger(root, changed.ledger)
    const reloaded = readDecisionLedger(root)
    expect(reloaded.decisions.find((d) => d.id === id)?.status).toBe('superseded')
    expect(reloaded.decisions.some((d) => d.successorOf === id && d.status === 'unresolved')).toBe(true)
    expect(reloaded.elements.find((el) => el.elementId === 'proc:Ship.Send')?.reviewMarks).toEqual(
      expect.arrayContaining(['stale', 'needs-review'])
    )
    expect(reloaded.audit.some((event) => event.kind === 'status-transition')).toBe(true)
    expect(logs.some((line) => line.startsWith('[dasr] status-transition'))).toBe(true)
  })

  it('blocks harness source edits, direct editor saves, and b0 when DASR is on', () => {
    const root = project()
    enableC2(root)
    const { ledger } = tracked()
    writeDecisionLedger(root, ledger)
    const source = 'module SYSTEM_Ship;\nend_module\n'
    const edited = applyHybridProposal(
      source,
      { target: 'hybrid', mode: 'source', operations: [{ op: 'append', text: '\nprocess Extra\nend_process\n' }] },
      root
    )
    expect(edited.applied).toBe(false)
    expect(edited.content).toBe(source)
    process.env.AGILE_SOFL_DASR = '1'
    const out = project()
    const informal = join(out, 'in.aspec')
    writeFileSync(informal, '# Functions\n\n## A\n\nDo A.\n')
    const b0 = runB0Auto({ informalPath: informal, outDir: out, runId: 'b0' })
    expect(b0.blocked).toBe(true)
    expect(existsSync(join(b0.runDir, 'hybrid.asfl'))).toBe(false)
    setActivePinia(createPinia())
    installDasrRuntime({ enabled: true, mode: 'C2', ledger })
    const doc = useDocumentStore()
    const tab = doc.newTab({ content: source, title: 'hybrid.asfl' })
    const history = useHistoryStore()
    expect(history.applyDocument(tab.id, 'module SYSTEM_Other;\nend_module\n', { kind: 'hybrid-edit', immediate: true })).toBe(false)
    expect(doc.tabs.find((item) => item.id === tab.id)?.content).toBe(source)
    expect(
      history.applyDocument(tab.id, 'module SYSTEM_Other;\nend_module\n', {
        kind: 'hybrid-edit',
        immediate: true,
        decisionImpact: { kind: 'elements', ids: ['proc:Ship.Quote'] },
        writePathId: 'direct-editor'
      })
    ).toBe(true)
    expect(impactForStoredPatch({ operations: [{ op: 'update', id: 'fn-ship' }] }).impact).toEqual({
      kind: 'elements',
      ids: ['fn-ship']
    })
  })
})
