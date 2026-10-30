/**
 * Decision provenance — the anti-fabrication core (conceptual-model section 5).
 *
 * The hard requirement: **an LLM guess can NEVER be set to `user_confirmed`.** Only a real (or, in
 * experiments, explicitly-simulated) actor can stamp provenance, and the status must match the actor:
 *   - `simulated_user` -> `simulated_user_answer` (or `deferred`). NEVER `user_confirmed` /
 *     `analyst_approved`. Reported as interaction *proxies* only (task book 7.3).
 *   - `user`           -> `user_confirmed` / `source_text_observation` / `deferred`.
 *   - `authorized_decider` -> `analyst_approved` / `user_confirmed` / `source_text_observation` / `deferred`.
 *
 * This module is the single place that rule lives, so every record path (Studio tool, harness, tests)
 * funnels through `assertProvenance` and cannot bypass it.
 */
import type { ActorKind, ProvenanceStatus } from './types.js'

export class ProvenanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProvenanceError'
  }
}

/** The provenance statuses each actor kind is allowed to stamp. */
const ALLOWED: Record<ActorKind, readonly ProvenanceStatus[]> = {
  user: ['user_confirmed', 'source_text_observation', 'deferred'],
  authorized_decider: ['analyst_approved', 'user_confirmed', 'source_text_observation', 'deferred'],
  // A simulated stakeholder can only produce a simulated answer. This is what makes the
  // anti-fabrication invariant structural: there is no code path from simulated_user to user_confirmed.
  simulated_user: ['simulated_user_answer', 'deferred'],
}

/** True iff `actorKind` may legitimately stamp `provenance`. */
export function isProvenanceLegal(actorKind: ActorKind, provenance: ProvenanceStatus): boolean {
  return ALLOWED[actorKind]?.includes(provenance) ?? false
}

/**
 * Throw a ProvenanceError unless `actorKind` may stamp `provenance`. This is the choke point the
 * anti-fabrication invariant depends on: a simulated user (or any non-real actor) can never produce
 * `user_confirmed`, so an LLM guess can never be laundered into a confirmed decision.
 */
export function assertProvenance(actorKind: ActorKind, provenance: ProvenanceStatus): void {
  if (!isProvenanceLegal(actorKind, provenance)) {
    throw new ProvenanceError(
      `actor '${actorKind}' may not stamp provenance '${provenance}' (allowed: ${ALLOWED[actorKind].join(', ')})`,
    )
  }
}

/** The provenance a node's content carries by default when produced by an LLM. */
export const DEFAULT_LLM_SOURCE: ProvenanceStatus = 'AI_hypothesis'

/**
 * A node promoted to a "confirmed" source must be backed by a real actor's decision. This guards the
 * node-level source field (not just decisions): an LLM-written node starts as `AI_hypothesis` and can
 * only become `user_confirmed`/`analyst_approved` via a recorded decision whose provenance passed
 * `assertProvenance`.
 */
export function isConfirmedSource(source: ProvenanceStatus): boolean {
  return source === 'user_confirmed' || source === 'analyst_approved'
}
