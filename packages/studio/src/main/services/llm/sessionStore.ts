import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentSession } from './agentTypes'
import { newId } from './agentTypes'
import { applySessionSlice, forkSessionRecord, type SessionBranchMode } from './sessionBranch'

function sessionsDir(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', 'agent', 'sessions')
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

export function listSessions(projectRoot: string): AgentSession[] {
  const dir = sessionsDir(projectRoot)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8')) as AgentSession
      } catch {
        return null
      }
    })
    .filter((s): s is AgentSession => Boolean(s))
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
      if (Boolean(a.archived) !== Boolean(b.archived)) return a.archived ? 1 : -1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export function loadSession(projectRoot: string, id: string): AgentSession | null {
  const file = join(sessionsDir(projectRoot), `${id}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as AgentSession
  } catch {
    return null
  }
}

export function saveSession(projectRoot: string, session: AgentSession): void {
  const dir = sessionsDir(projectRoot)
  ensureDir(dir)
  session.updatedAt = new Date().toISOString()
  writeFileSync(join(dir, `${session.id}.json`), JSON.stringify(session, null, 2), 'utf8')
}

export function deleteSession(projectRoot: string, id: string): boolean {
  const file = join(sessionsDir(projectRoot), `${id}.json`)
  if (!existsSync(file)) return false
  unlinkSync(file)
  return true
}

export function createSession(projectRoot: string, moduleId: string, title?: string): AgentSession {
  const now = new Date().toISOString()
  const session: AgentSession = {
    id: newId('ses'),
    moduleId,
    title: title || 'Requirement Analysis',
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: { skillId: 'requirement-discovery' }
  }
  saveSession(projectRoot, session)
  return session
}

export function renameSession(projectRoot: string, id: string, title: string): AgentSession | null {
  const session = loadSession(projectRoot, id)
  if (!session) return null
  session.title = title.trim() || session.title
  saveSession(projectRoot, session)
  return session
}

export function duplicateSession(projectRoot: string, id: string): AgentSession | null {
  const session = loadSession(projectRoot, id)
  if (!session) return null
  const now = new Date().toISOString()
  const copy: AgentSession = {
    ...session,
    id: newId('ses'),
    title: `${session.title} copy`,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false
  }
  saveSession(projectRoot, copy)
  return copy
}

export function forkSession(
  projectRoot: string,
  id: string,
  throughMessageId: string,
  options?: { mode?: SessionBranchMode; title?: string }
): AgentSession | null {
  const session = loadSession(projectRoot, id)
  if (!session) return null
  const copy = forkSessionRecord(session, throughMessageId, options)
  if (!copy) return null
  saveSession(projectRoot, copy)
  return copy
}

export function rewindSession(
  projectRoot: string,
  id: string,
  throughMessageId: string,
  options?: { mode?: SessionBranchMode }
): AgentSession | null {
  const session = loadSession(projectRoot, id)
  if (!session) return null
  const next = applySessionSlice(session, throughMessageId, options?.mode ?? 'reset')
  if (!next) return null
  saveSession(projectRoot, next)
  return next
}

export function setSessionFlag(
  projectRoot: string,
  id: string,
  flag: 'pinned' | 'archived',
  value: boolean
): AgentSession | null {
  const session = loadSession(projectRoot, id)
  if (!session) return null
  session[flag] = value
  saveSession(projectRoot, session)
  return session
}
