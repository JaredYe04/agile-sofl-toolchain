import type { AgentMessage, AgentSession } from './agentTypes'
import { newId } from './agentTypes'

export type SessionBranchMode = 'keep' | 'reset'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toolIdsFor(message: AgentMessage): Set<string> {
  const ids = new Set<string>()
  for (const call of message.toolCalls ?? []) ids.add(call.id)
  if (message.clarification?.pendingToolCallId) ids.add(message.clarification.pendingToolCallId)
  return ids
}

function pendingToolCallIdOf(message: AgentMessage): string | undefined {
  if (!message.pending) return undefined
  return message.clarification?.pendingToolCallId ?? message.toolCalls?.[0]?.id
}

function lastPendingToolCallId(messages: AgentMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const id = pendingToolCallIdOf(messages[i]!)
    if (id) return id
  }
  return undefined
}

function endIndexThrough(messages: AgentMessage[], idx: number, mode: SessionBranchMode): number {
  if (mode === 'reset') return idx
  const toolIds = toolIdsFor(messages[idx]!)
  let end = idx
  let i = idx + 1
  while (i < messages.length && messages[i]!.role === 'tool' && toolIds.has(messages[i]!.id)) {
    end = i
    i += 1
  }
  return end
}

export function sliceSessionMessages(
  messages: AgentMessage[],
  throughMessageId: string,
  mode: SessionBranchMode,
  exclusive?: boolean
): { messages: AgentMessage[]; pendingToolCallId?: string } | null {
  const idx = messages.findIndex((m) => m.id === throughMessageId)
  if (idx < 0) return null
  if (exclusive) {
    const sliced = clone(messages.slice(0, idx))
    return { messages: sliced, pendingToolCallId: lastPendingToolCallId(sliced) }
  }
  const sliced = clone(messages.slice(0, endIndexThrough(messages, idx, mode) + 1))
  if (mode === 'reset') {
    const msg = sliced[Math.min(idx, sliced.length - 1)]!
    msg.pending = true
    msg.resolution = undefined
    if (msg.clarification) {
      msg.clarification = { ...msg.clarification, answer: undefined }
    }
    return {
      messages: sliced,
      pendingToolCallId: msg.clarification?.pendingToolCallId ?? msg.toolCalls?.[0]?.id
    }
  }
  return { messages: sliced, pendingToolCallId: lastPendingToolCallId(sliced) }
}

export function applySessionSlice(
  session: AgentSession,
  throughMessageId: string,
  mode: SessionBranchMode,
  exclusive?: boolean
): AgentSession | null {
  const sliced = sliceSessionMessages(session.messages, throughMessageId, mode, exclusive)
  if (!sliced) return null
  return {
    ...session,
    messages: sliced.messages,
    context: { ...session.context, pendingToolCallId: sliced.pendingToolCallId }
  }
}

export function forkSessionRecord(
  session: AgentSession,
  throughMessageId: string,
  options?: { mode?: SessionBranchMode; title?: string }
): AgentSession | null {
  const sliced = applySessionSlice(session, throughMessageId, options?.mode ?? 'keep')
  if (!sliced) return null
  const now = new Date().toISOString()
  const copy = clone(sliced)
  copy.id = newId('ses')
  copy.title = options?.title?.trim() || `${session.title}`
  copy.createdAt = now
  copy.updatedAt = now
  copy.pinned = false
  copy.archived = false
  return copy
}
