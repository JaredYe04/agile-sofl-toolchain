/**
 * Node lifecycle — an explicit, testable state machine (conceptual-model section 4).
 *
 * `draft -> needs_clarification -> ready`, with `deferred`, `blocked`, `invalidated`. A change can move
 * a `ready` node back to `needs_clarification` (via dependency propagation). Transitions are explicit and
 * unit-tested — NOT a frontend color. `deferred` is not a default approval.
 */
import type { NodeStatus } from './types.js'

export class LifecycleError extends Error {
  constructor(from: NodeStatus, to: NodeStatus) {
    super(`illegal lifecycle transition: ${from} -> ${to}`)
    this.name = 'LifecycleError'
  }
}

/** Allowed outgoing transitions per state. Self-transition is always a no-op (treated as legal). */
const TRANSITIONS: Record<NodeStatus, readonly NodeStatus[]> = {
  draft: ['needs_clarification', 'ready', 'deferred', 'blocked', 'invalidated'],
  needs_clarification: ['ready', 'deferred', 'blocked', 'invalidated'],
  // A ready node can be pulled back to needs_clarification by propagation (section 4).
  ready: ['needs_clarification', 'deferred', 'blocked', 'invalidated'],
  deferred: ['draft', 'needs_clarification', 'ready', 'invalidated'],
  blocked: ['draft', 'needs_clarification', 'invalidated'],
  invalidated: ['draft'],
}

/** The states a node may legally move to from `from`. */
export function allowedTransitions(from: NodeStatus): readonly NodeStatus[] {
  return TRANSITIONS[from]
}

/** True iff moving a node from `from` to `to` is a legal transition (same state is always legal). */
export function canTransition(from: NodeStatus, to: NodeStatus): boolean {
  if (from === to) return true
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** Throw a LifecycleError unless the transition is legal (same state is a no-op). */
export function assertTransition(from: NodeStatus, to: NodeStatus): void {
  if (!canTransition(from, to)) throw new LifecycleError(from, to)
}
