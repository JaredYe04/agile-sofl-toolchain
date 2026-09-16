export type AgentQueuedMessage = {
  id: string
  text: string
}

export type ComposerAction = 'send' | 'stop' | 'enqueue'

export function composerAction(busy: boolean, input: string): ComposerAction {
  if (busy) return input.trim() ? 'enqueue' : 'stop'
  return 'send'
}

export function createQueuedMessage(text: string, id = crypto.randomUUID()): AgentQueuedMessage | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return { id, text: trimmed }
}

export function enqueueMessage(
  queue: AgentQueuedMessage[],
  text: string
): AgentQueuedMessage[] {
  const item = createQueuedMessage(text)
  if (!item) return queue
  return [...queue, item]
}

export function updateQueuedMessage(
  queue: AgentQueuedMessage[],
  id: string,
  text: string
): AgentQueuedMessage[] {
  const trimmed = text.trim()
  if (!trimmed) return queue.filter((item) => item.id !== id)
  return queue.map((item) => (item.id === id ? { ...item, text: trimmed } : item))
}

export function removeQueuedMessage(queue: AgentQueuedMessage[], id: string): AgentQueuedMessage[] {
  return queue.filter((item) => item.id !== id)
}

export function shiftQueuedMessage(queue: AgentQueuedMessage[]): {
  next: AgentQueuedMessage | null
  rest: AgentQueuedMessage[]
} {
  if (!queue.length) return { next: null, rest: queue }
  const [next, ...rest] = queue
  return { next, rest }
}
