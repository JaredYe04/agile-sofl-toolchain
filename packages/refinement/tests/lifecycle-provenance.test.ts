import { describe, expect, it } from 'vitest'
import {
  canTransition,
  allowedTransitions,
  assertTransition,
  LifecycleError,
  isProvenanceLegal,
  assertProvenance,
  ProvenanceError,
  isConfirmedSource,
} from '../src/index.js'

describe('lifecycle state machine', () => {
  it('allows the forward happy path draft -> needs_clarification -> ready', () => {
    expect(canTransition('draft', 'needs_clarification')).toBe(true)
    expect(canTransition('needs_clarification', 'ready')).toBe(true)
  })

  it('allows ready -> needs_clarification (propagation pulls a ready node back)', () => {
    // This is the specific transition the design calls out (section 4).
    expect(canTransition('ready', 'needs_clarification')).toBe(true)
  })

  it('allows deferral from any active state', () => {
    for (const from of ['draft', 'needs_clarification', 'ready'] as const) {
      expect(canTransition(from, 'deferred')).toBe(true)
    }
  })

  it('recovers from deferred back to work states', () => {
    expect(canTransition('deferred', 'draft')).toBe(true)
    expect(canTransition('deferred', 'needs_clarification')).toBe(true)
    expect(canTransition('deferred', 'ready')).toBe(true)
  })

  it('allows re-entry from invalidated to draft only', () => {
    expect(canTransition('invalidated', 'draft')).toBe(true)
    expect(canTransition('invalidated', 'ready')).toBe(false)
    expect(canTransition('invalidated', 'needs_clarification')).toBe(false)
  })

  it('rejects impossible transitions', () => {
    // blocked cannot go straight to ready (must be unblocked first).
    expect(canTransition('blocked', 'ready')).toBe(false)
    // invalidated is terminal except via draft.
    expect(canTransition('invalidated', 'deferred')).toBe(false)
  })

  it('same-state is always a legal no-op', () => {
    for (const s of ['draft', 'ready', 'blocked'] as const) {
      expect(canTransition(s, s)).toBe(true)
    }
  })

  it('assertTransition throws on illegal and passes on legal', () => {
    expect(() => assertTransition('blocked', 'ready')).toThrowError(LifecycleError)
    expect(() => assertTransition('draft', 'needs_clarification')).not.toThrow()
  })

  it('allowedTransitions lists the documented exits', () => {
    expect(allowedTransitions('draft')).toEqual(
      expect.arrayContaining(['needs_clarification', 'ready', 'deferred', 'blocked', 'invalidated']),
    )
    expect(allowedTransitions('blocked')).toEqual(expect.arrayContaining(['draft', 'needs_clarification']))
  })
})

describe('provenance (anti-fabrication)', () => {
  it('a real user may stamp user_confirmed / source_text_observation / deferred', () => {
    expect(isProvenanceLegal('user', 'user_confirmed')).toBe(true)
    expect(isProvenanceLegal('user', 'source_text_observation')).toBe(true)
    expect(isProvenanceLegal('user', 'deferred')).toBe(true)
  })

  it('an authorized decider may stamp analyst_approved', () => {
    expect(isProvenanceLegal('authorized_decider', 'analyst_approved')).toBe(true)
    expect(isProvenanceLegal('authorized_decider', 'user_confirmed')).toBe(true)
  })

  it('a simulated user CANNOT stamp user_confirmed or analyst_approved (the core invariant)', () => {
    expect(isProvenanceLegal('simulated_user', 'user_confirmed')).toBe(false)
    expect(isProvenanceLegal('simulated_user', 'analyst_approved')).toBe(false)
    expect(isProvenanceLegal('simulated_user', 'source_text_observation')).toBe(false)
  })

  it('a simulated user CAN stamp simulated_user_answer (or deferred)', () => {
    expect(isProvenanceLegal('simulated_user', 'simulated_user_answer')).toBe(true)
    expect(isProvenanceLegal('simulated_user', 'deferred')).toBe(true)
  })

  it('an LLM guess (AI_hypothesis) is not a legal stamp for any actor', () => {
    for (const actor of ['user', 'authorized_decider', 'simulated_user'] as const) {
      expect(isProvenanceLegal(actor, 'AI_hypothesis')).toBe(false)
    }
  })

  it('assertProvenance throws for a simulated user claiming user_confirmed', () => {
    expect(() => assertProvenance('simulated_user', 'user_confirmed')).toThrowError(ProvenanceError)
  })

  it('assertProvenance passes for a real user confirming', () => {
    expect(() => assertProvenance('user', 'user_confirmed')).not.toThrow()
  })

  it('isConfirmedSource identifies the confirmed statuses', () => {
    expect(isConfirmedSource('user_confirmed')).toBe(true)
    expect(isConfirmedSource('analyst_approved')).toBe(true)
    expect(isConfirmedSource('AI_hypothesis')).toBe(false)
    expect(isConfirmedSource('simulated_user_answer')).toBe(false)
  })
})
