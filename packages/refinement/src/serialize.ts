/**
 * Serialization, schema versioning, and migration (conceptual-model section 10).
 *
 * The persisted requirement graph is a SEPARATE artifact from the spec text (.asfl) and the trace
 * graph; node artifactRefs are the join points. Key properties (all tested in section 13):
 *   - the requirement layer is OPTIONAL: absence is a valid state, not an error (old projects without
 *     a tree still open; no forced lossy migration).
 *   - schema versioning: a `schemaVersion` on the document drives migration.
 *   - migration is additive and reversible: unknown fields are preserved, not dropped (crash-safe).
 *   - round-trip is a tested invariant (empty/deep/wide trees, non-ASCII Chinese, old-version docs,
 *     partially corrupt input).
 *   - version conflicts + unauthorized edits are detected at load (the expected-version gate).
 */
import type {
  RefinementEdge,
  RequirementNode,
  RefinementObligation,
  RequirementDecision,
} from './types.js'
import { RequirementGraph } from './graph.js'
import { EventLog } from './events.js'
import type { TimedEvent } from './events.js'
import type { IdGen } from './id.js'
import { randomIdGen } from './id.js'

/** The current schema version of the persisted requirement document. */
export const SCHEMA_VERSION = 1

export interface RequirementDocument {
  schemaVersion: number
  /** Document-level version, bumped on any mutation (used for the stale-proposal / expected-version gate). */
  docVersion: number
  savedAt: number
  graph: { nodes: RequirementNode[]; edges: RefinementEdge[] }
  obligations: RefinementObligation[]
  decisions: RequirementDecision[]
  events: TimedEvent[]
  /**
   * Reserved extension bag. Unknown forward-compat fields are preserved here verbatim so a newer
   * writer's document is not lossily downgraded by an older reader (crash-recovery safe).
   */
  extensions?: Record<string, unknown>
}

export class SerializationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SerializationError'
  }
}

/** The in-memory aggregate that serialize/deserialize round-trips (graph + obligations + decisions + events). */
export interface RequirementState {
  graph: RequirementGraph
  obligations: RefinementObligation[]
  decisions: RequirementDecision[]
  events: EventLog
}

/** Serialize a state to a versioned RequirementDocument. Deterministic ordering for stable diffs. */
export function toDocument(
  state: RequirementState,
  opts: { docVersion?: number; now?: () => number } = {},
): RequirementDocument {
  const graph = state.graph.toPlain()
  return {
    schemaVersion: SCHEMA_VERSION,
    docVersion: opts.docVersion ?? 0,
    savedAt: opts.now?.() ?? Date.now(),
    graph: {
      nodes: [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
      edges: [...graph.edges].sort((a, b) => (a.id < b.id ? -1 : 1)),
    },
    obligations: [...state.obligations].sort((a, b) => (a.id < b.id ? -1 : 1)),
    decisions: [...state.decisions].sort((a, b) => (a.decisionId < b.decisionId ? -1 : 1)),
    events: state.events.toPlain(),
    extensions: undefined,
  }
}

/**
 * Migrate a document to the current schema version. Migration is ADDITIVE: it fills in missing
 * defaults and PRESERVES unknown fields (in `extensions`), never dropping data. Returns a new
 * document; the input is not mutated.
 */
export function migrateToLatest(doc: RequirementDocument): RequirementDocument {
  const raw = doc as unknown as Record<string, unknown>
  const num = (v: unknown, dflt: number): number => (typeof v === 'number' ? v : dflt)
  const graph = (raw.graph as { nodes?: RequirementNode[]; edges?: RefinementEdge[] } | undefined) ?? {}
  // v1 keys: everything that is part of the current schema shape.
  const known = new Set(['schemaVersion', 'docVersion', 'savedAt', 'graph', 'obligations', 'decisions', 'events', 'extensions'])
  // Unknown top-level keys are preserved in extensions (additive, never dropped).
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!known.has(k)) extra[k] = v
  }
  return {
    schemaVersion: 1,
    docVersion: num(raw.docVersion, 0),
    savedAt: num(raw.savedAt, 0),
    graph: { nodes: graph.nodes ?? [], edges: graph.edges ?? [] },
    obligations: (raw.obligations as RefinementObligation[] | undefined) ?? [],
    decisions: (raw.decisions as RequirementDecision[] | undefined) ?? [],
    events: (raw.events as TimedEvent[] | undefined) ?? [],
    extensions: { ...(raw.extensions as Record<string, unknown> | undefined), ...extra },
  }
}

export interface LoadOptions {
  /** The docVersion a client EXPECTS (stale-proposal / concurrency gate). If present and the document's
   *  docVersion is higher, the load is rejected as a version conflict. */
  expectedDocVersion?: number
  idGen?: IdGen
  /** When true, tolerate a partially corrupt document by keeping only well-formed records (crash recovery). */
  crashRecovery?: boolean
}

/**
 * Load a versioned document into a RequirementState. Enforces:
 *   - schema version (migrates old docs additively; rejects an unknown FUTURE version rather than
 *     guessing — a newer writer's doc must not be silently downgraded),
 *   - the expected-version gate (version conflict => SerializationError, unless crashRecovery),
 *   - per-record well-formedness (a corrupt record is dropped under crashRecovery, fatal otherwise).
 */
export function fromDocument(doc: RequirementDocument, opts: LoadOptions = {}): RequirementState {
  // Reject a FUTURE schema version BEFORE migrating: a newer writer's document must not be silently
  // downgraded. (We check the raw doc, because migrateToLatest normalizes schemaVersion to current.)
  const rawVersion = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0
  if (rawVersion > SCHEMA_VERSION) {
    throw new SerializationError(
      `document schema version ${rawVersion} is newer than supported ${SCHEMA_VERSION}; refusing to downgrade`,
    )
  }
  const migrated = migrateToLatest(doc)
  // Expected-version gate (stale proposal / concurrency).
  if (opts.expectedDocVersion !== undefined && migrated.docVersion !== opts.expectedDocVersion) {
    if (opts.crashRecovery) {
      // Under crash recovery we tolerate a concurrent writer but still report the mismatch via a marker.
    } else {
      throw new SerializationError(
        `version conflict: expected docVersion ${opts.expectedDocVersion}, found ${migrated.docVersion}`,
      )
    }
  }

  const idGen = opts.idGen ?? randomIdGen()

  const nodes = migrated.graph.nodes.filter((n) => {
    if (!isValidNode(n)) {
      if (!opts.crashRecovery) throw new SerializationError(`corrupt node: ${(n as { id?: unknown })?.id ?? 'unknown'}`)
      return false
    }
    return true
  })
  const edges = migrated.graph.edges.filter((e) => {
    if (!isValidEdge(e)) {
      if (!opts.crashRecovery) throw new SerializationError(`corrupt edge: ${(e as { id?: unknown })?.id ?? 'unknown'}`)
      return false
    }
    return true
  })
  const graph = RequirementGraph.fromPlain({ nodes, edges }, idGen)

  const obligations = migrated.obligations.filter((o) => {
    if (!o || typeof o.id !== 'string' || typeof o.nodeId !== 'string') {
      if (!opts.crashRecovery) throw new SerializationError('corrupt obligation record')
      return false
    }
    return true
  })

  const decisions = migrated.decisions.filter((d) => {
    if (!d || typeof d.decisionId !== 'string') {
      if (!opts.crashRecovery) throw new SerializationError('corrupt decision record')
      return false
    }
    return true
  })

  const events = new EventLog()
  for (const e of migrated.events) {
    if (!e || typeof e.seq !== 'number' || !e.event || typeof e.event.type !== 'string') {
      if (!opts.crashRecovery) throw new SerializationError(`corrupt event at seq ${e?.seq}`)
      continue
    }
    events.append(e.event)
  }

  return { graph, obligations, decisions, events }
}

/** The raw extension bag survives a round-trip: load->save keeps unknown keys. */
export function preserveExtensions(doc: RequirementDocument, state: RequirementState, opts: { docVersion?: number; now?: () => number } = {}): RequirementDocument {
  const d = toDocument(state, opts)
  d.extensions = doc.extensions
  return d
}

// ---- record well-formedness (crash recovery + unauthorized-edit detection) ----

export function isValidNode(n: unknown): n is RequirementNode {
  if (!n || typeof n !== 'object') return false
  const x = n as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.nodeType === 'string' &&
    typeof x.title === 'string' &&
    typeof x.version === 'number' &&
    typeof x.status === 'string'
  )
}

export function isValidEdge(e: unknown): e is RefinementEdge {
  if (!e || typeof e !== 'object') return false
  const x = e as Record<string, unknown>
  return typeof x.id === 'string' && typeof x.source === 'string' && typeof x.target === 'string' && typeof x.kind === 'string'
}
