export type AgentWriteMode = 'ask' | 'auto'

export const AGENT_WRITE_MODE_KEY = 'studio-agent-write-mode'

export function readAgentWriteMode(storage: Pick<Storage, 'getItem'> | null | undefined): AgentWriteMode {
  const raw = storage?.getItem(AGENT_WRITE_MODE_KEY)
  return raw === 'auto' ? 'auto' : 'ask'
}

export function persistAgentWriteMode(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  mode: AgentWriteMode
): void {
  storage?.setItem(AGENT_WRITE_MODE_KEY, mode === 'auto' ? 'auto' : 'ask')
}
