export type TurnMessage = {
  id: string
  role: string
  content?: string
  timestamp?: string
  thinking?: string
  streaming?: boolean
  toolCalls?: readonly unknown[]
}

export type AgentTurn<T extends TurnMessage> = {
  id: string
  user: T | null
  assistants: T[]
  summaryId: string | null
  live: boolean
  startedAt: number
  endedAt: number
}

function stamp(message: TurnMessage | null): number | null {
  if (!message?.timestamp) return null
  const value = Date.parse(message.timestamp)
  return Number.isFinite(value) ? value : null
}

function finishTurn<T extends TurnMessage>(current: { user: T | null; assistants: T[] }): AgentTurn<T> {
  let summaryId: string | null = null
  for (let i = current.assistants.length - 1; i >= 0; i--) {
    if ((current.assistants[i]?.content ?? '').trim()) {
      summaryId = current.assistants[i]!.id
      break
    }
  }
  const stamps = [stamp(current.user), ...current.assistants.map((message) => stamp(message))].filter(
    (value): value is number => value != null
  )
  const startedAt = stamps[0] ?? Date.now()
  const endedAt = stamps[stamps.length - 1] ?? startedAt
  const streaming = current.assistants.some((message) => message.streaming)
  return {
    id: current.user?.id ?? current.assistants[0]?.id ?? 'turn',
    user: current.user,
    assistants: current.assistants,
    summaryId,
    live: streaming,
    startedAt,
    endedAt
  }
}

/** Group a visible transcript into user turns plus the assistant work that follows each one. */
export function groupAgentTurns<T extends TurnMessage>(messages: T[], busy: boolean): AgentTurn<T>[] {
  const turns: AgentTurn<T>[] = []
  let current: { user: T | null; assistants: T[] } | null = null
  const flush = () => {
    if (!current || (!current.user && current.assistants.length === 0)) {
      current = null
      return
    }
    turns.push(finishTurn(current))
    current = null
  }
  for (const message of messages) {
    if (message.role === 'user') {
      flush()
      current = { user: message, assistants: [] }
      continue
    }
    if (message.role !== 'assistant') continue
    if (!current) current = { user: null, assistants: [] }
    current.assistants.push(message)
  }
  flush()
  if (busy && turns.length) {
    const last = turns[turns.length - 1]!
    turns[turns.length - 1] = { ...last, live: true }
  }
  return turns
}

/** Thinking or tool calls. Streaming text alone is the summary, not a second copy of the message. */
export function messageHasTrace(message: TurnMessage): boolean {
  return Boolean((message.thinking ?? '').trim() || (message.toolCalls?.length ?? 0) > 0)
}

/**
 * Prose belongs on one row. A summary, clarification, or patch row owns the text;
 * the work row keeps only thinking and tool traces. hideText drops a sentence the
 * card already shows (clarification question, or a patch explanation copied into content).
 */
export function assistantTextVisible(
  kind: 'work' | 'summary',
  messageId: string,
  summaryId: string | null,
  options?: { pinned?: boolean; hideText?: boolean }
): boolean {
  if (options?.hideText) return false
  const pinned = options?.pinned ?? messageId === summaryId
  if (pinned) return kind === 'summary'
  return kind === 'work'
}

export function turnHasWork<T extends TurnMessage>(turn: AgentTurn<T>): boolean {
  return turn.assistants.some((message) => {
    if (message.id === turn.summaryId) return messageHasTrace(message)
    return true
  })
}

export function workDurationMs(turn: Pick<AgentTurn<TurnMessage>, 'live' | 'startedAt' | 'endedAt'>, now: number): number {
  const end = turn.live ? Math.max(now, turn.endedAt) : turn.endedAt
  return Math.max(0, end - turn.startedAt)
}

export function workDurationParts(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(1, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { h, m, s }
}
