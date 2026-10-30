/**
 * Stable ID generation.
 *
 * IDs must be UNIQUE (a name collision is never an identity collision) and, for the replay invariant
 * (conceptual-model section 9/13: replaying the event stream from an empty state reconstructs the same
 * graph), DETERMINISTIC given the same inputs. So the generator is injectable:
 *   - default: crypto.randomUUID() (real use)
 *   - tests/replay: a deterministic counter-based generator
 */
import { randomUUID } from 'node:crypto'

export type IdGen = (prefix: string) => string

/** Real, random UUIDs. `prefix` is the fallback if a call omits it. */
export function randomIdGen(prefix = 'rn'): IdGen {
  return (p = prefix) => `${p}_${randomUUID()}`
}

/**
 * Deterministic, collision-free IDs for tests and replay. `start` advances per call so replaying the
 * same event sequence yields the same ids. The prefix is embedded for readability.
 */
export function deterministicIdGen(prefix = 'rn', start = 1): IdGen {
  let n = start
  return (p = prefix) => `${p}_d${n++}`
}
