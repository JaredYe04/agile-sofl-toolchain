export type AgentRole = 'user' | 'assistant' | 'system' | 'tool'

export type ClarificationOption = { id: string; label: string }

export type ClarificationPrompt = {
  id: string
  question: string
  options?: ClarificationOption[]
  allowCustom: boolean
  multiSelect?: boolean
  pendingToolCallId?: string
  answer?: string
}

export type ReviewIssue = {
  dimension: string
  message: string
  nodeId?: string
}

export type InformalPatchPayload = {
  explanation?: string
  operations: Array<Record<string, unknown>>
}

export type AgentToolCall = {
  id: string
  name: string
  arguments: string
}

export type AgentMessage = {
  id: string
  role: AgentRole
  content: string
  timestamp: string
  skillId?: string
  thinking?: string
  streaming?: boolean
  toolCalls?: AgentToolCall[]
  proposedChanges?: InformalPatchPayload
  clarification?: ClarificationPrompt
  review?: { issues: ReviewIssue[] }
  pending?: boolean
  resolution?: 'applied' | 'rejected' | 'answered'
}

export type AgentSession = {
  id: string
  moduleId: string
  title: string
  createdAt: string
  updatedAt: string
  pinned?: boolean
  archived?: boolean
  messages: AgentMessage[]
  context: {
    skillId?: string
    selectedNodeId?: string
    pendingToolCallId?: string
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
