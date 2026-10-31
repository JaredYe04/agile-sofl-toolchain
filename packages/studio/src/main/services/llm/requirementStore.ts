/**
 * Per-project persistence for the stateful `RefinementSession` (task book §6.1 — "keep the agent
 * decoupled from the persistence model").
 *
 * The agent loop is per-turn (and the Studio is Electron / headless-harness), but a
 * `RefinementSession` is stateful across turns. This store is the ONE place that bridges them: it
 * serializes the session to a `SessionSnapshot` in a per-project JSON artifact and restores it on
 * demand. The requirement layer is a SEPARATE artifact from the spec text (`.asfl`) and the dual-line
 * refinement log (`refinement-log.jsonl`) — its absence is a valid state (old projects still open; no
 * forced migration).
 *
 * This module deliberately lives in the Electron main process (it uses node:fs). The PURE tool
 * executor (`requirementTools.ts`) takes an already-loaded session, so the 5 tools stay unit-testable
 * without Electron — only this thin persistence boundary touches the filesystem.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RefinementSession, type SessionSnapshot } from '@agile-sofl/refinement'

const FILE_NAME = 'requirement-graph.json'

function requirementPath(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', FILE_NAME)
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

/**
 * Load the project's requirement session from disk. Returns a FRESH session when no artifact exists
 * (the requirement layer is optional) or when the artifact is unreadable/corrupt (crash-recovery: an
 * unreadable file must not take the project down — it degrades to an empty tree, not an error).
 *
 * Restores with injectable deterministic-free defaults: random id generators + the real clock. Ids are
 * assigned by the core on the NEXT mutation, so restore itself never needs an id generator; the
 * snapshot carries every id that already exists.
 */
export function loadRequirementSession(projectRoot: string): RefinementSession {
  const path = requirementPath(projectRoot)
  if (!projectRoot || !existsSync(path)) return new RefinementSession()
  let snapshot: SessionSnapshot
  try {
    snapshot = JSON.parse(readFileSync(path, 'utf8')) as SessionSnapshot
  } catch {
    return new RefinementSession()
  }
  try {
    return RefinementSession.restore(snapshot)
  } catch {
    return new RefinementSession()
  }
}

/** Persist the current session state as a `SessionSnapshot`. No-op (returns false) for an empty
 *  session so we never create an artifact for a project that has no requirement layer yet. */
export function saveRequirementSession(projectRoot: string, session: RefinementSession): boolean {
  if (!projectRoot) return false
  // Only write once the requirement layer actually has content (a node or an obligation/decision).
  const snapshot = session.snapshot()
  const hasContent =
    snapshot.graph.nodes.length > 0 || snapshot.obligations.length > 0 || snapshot.decisions.length > 0
  if (!hasContent) return false
  ensureDir(join(projectRoot, '.agile-sofl'))
  writeFileSync(requirementPath(projectRoot), JSON.stringify(snapshot), 'utf8')
  return true
}

/** Remove the requirement artifact (e.g. when a project is reset). Best-effort. */
export function clearRequirementSession(projectRoot: string): void {
  const path = requirementPath(projectRoot)
  if (projectRoot && existsSync(path)) {
    try {
      unlinkSync(path)
    } catch {
      /* best-effort */
    }
  }
}
