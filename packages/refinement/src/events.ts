/**
 * Append-only, replayable domain event log (conceptual-model section 9).
 *
 * Every key transition (node CRUD, edge change, obligation open/discharge, decision record/withdraw,
 * propagation, readiness recompute, revision) is emitted as an event. The stream is:
 *   - append-only (no in-place mutation; corrections are new events),
 *   - sequenced (monotonic index, for deterministic ordering),
 *   - replayable: replaying the stream from an empty state with the same id generator reconstructs the
 *     same final graph (the P3/P4 replay invariant).
 *
 * The log does not know how to APPLY events to a graph — that is the reducer's job (Studio/harness/tests
 * supply an `onEvent` callback), so the log stays a pure record.
 */
import type { RefinementEvent } from './types.js'

export interface TimedEvent {
  /** Monotonic sequence number (0-based, dense). */
  seq: number
  /** Wall-clock timestamp (informational; NOT used for replay ordering — seq is). */
  ts: number
  event: RefinementEvent
}

/**
 * An in-memory append-only event log. `clock` is injectable for deterministic tests.
 */
export class EventLog {
  private events: TimedEvent[] = []
  private readonly clock: () => number

  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock
  }

  /** Append an event. Returns the recorded TimedEvent (with its assigned seq). */
  append(event: RefinementEvent): TimedEvent {
    const timed: TimedEvent = { seq: this.events.length, ts: this.clock(), event }
    this.events.push(timed)
    return timed
  }

  /** All events in order. A shallow copy of the array; elements are shared (read-only by convention). */
  all(): TimedEvent[] {
    return [...this.events]
  }

  /** Events with a given event.type (e.g. 'obligation_opened'). */
  ofType<T extends RefinementEvent['type']>(type: T): TimedEvent[] {
    return this.events.filter((e) => e.event.type === type)
  }

  get length(): number {
    return this.events.length
  }

  get last(): TimedEvent | undefined {
    return this.events[this.events.length - 1]
  }

  /**
   * Serialize to a plain JSON-friendly array (additive; unknown event types are preserved verbatim, not
   * dropped — crash-recovery safe, section 10).
   */
  toPlain(): TimedEvent[] {
    return this.events.map((e) => ({ seq: e.seq, ts: e.ts, event: e.event }))
  }

  /** Rebuild a log from a plain array, re-validating the sequence is dense from 0. */
  static fromPlain(data: TimedEvent[]): EventLog {
    const log = new EventLog()
    for (const e of data) {
      log.events.push({ seq: e.seq, ts: e.ts, event: e.event })
    }
    // Validate dense sequencing; a corrupt log is a contract violation.
    for (let i = 0; i < log.events.length; i++) {
      if (log.events[i].seq !== i) {
        throw new Error(`event log is not densely sequenced (expected seq ${i}, found ${log.events[i].seq})`)
      }
    }
    return log
  }

  /** Replace the internal log in place (session restore), re-validating dense sequencing from 0. */
  load(data: TimedEvent[]): void {
    const events: TimedEvent[] = []
    for (const e of data) {
      events.push({ seq: e.seq, ts: e.ts, event: e.event })
    }
    for (let i = 0; i < events.length; i++) {
      if (events[i].seq !== i) {
        throw new Error(`event log is not densely sequenced (expected seq ${i}, found ${events[i].seq})`)
      }
    }
    this.events = events
  }
}
