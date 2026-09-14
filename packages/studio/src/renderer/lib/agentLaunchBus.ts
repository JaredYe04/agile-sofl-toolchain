import type { HybridAgentBootstrapPayload } from '../../preload/index'

type Handler = (req: HybridAgentBootstrapPayload) => void

const handlers = new Set<Handler>()
let pending: HybridAgentBootstrapPayload | null = null

export function emitAgentLaunch(req: HybridAgentBootstrapPayload): void {
  pending = req
  for (const handler of handlers) handler(req)
}

export function subscribeAgentLaunch(handler: Handler): () => void {
  handlers.add(handler)
  if (pending) handler(pending)
  return () => {
    handlers.delete(handler)
  }
}

export function consumeAgentLaunchPending(): HybridAgentBootstrapPayload | null {
  const req = pending
  pending = null
  return req
}
