import { describe, expect, it } from 'vitest'
import type { AgentMessage, AgentSession } from '../src/main/services/llm/agentTypes'
import { forkSessionRecord, sliceSessionMessages } from '../src/main/services/llm/sessionBranch'

function msg(partial: Partial<AgentMessage> & Pick<AgentMessage, 'id' | 'role'>): AgentMessage {
  return {
    content: '',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

function session(messages: AgentMessage[]): AgentSession {
  return {
    id: 'ses-orig',
    moduleId: 'project',
    title: 'ATM',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages,
    context: { skillId: 'requirement-discovery', pendingToolCallId: 'call-2' }
  }
}

const thread: AgentMessage[] = [
  msg({ id: 'u1', role: 'user', content: '做一个 ATM' }),
  msg({
    id: 'a1',
    role: 'assistant',
    content: '用户是谁？',
    pending: false,
    resolution: 'answered',
    toolCalls: [{ id: 'call-1', name: 'ask_clarification', arguments: '{}' }],
    clarification: {
      id: 'q1',
      question: '用户是谁？',
      allowCustom: true,
      pendingToolCallId: 'call-1',
      answer: '储户',
      options: [
        { id: 'opt-a', label: '储户' },
        { id: 'opt-b', label: '柜员' }
      ]
    }
  }),
  msg({ id: 'call-1', role: 'tool', content: '{"answer":"储户"}' }),
  msg({
    id: 'a2',
    role: 'assistant',
    content: '下一步？',
    pending: true,
    toolCalls: [{ id: 'call-2', name: 'ask_clarification', arguments: '{}' }],
    clarification: {
      id: 'q2',
      question: '下一步？',
      allowCustom: true,
      pendingToolCallId: 'call-2'
    }
  })
]

describe('sliceSessionMessages', () => {
  it('keeps the answered tool result when forking from a clarification', () => {
    const sliced = sliceSessionMessages(thread, 'a1', 'keep')
    expect(sliced?.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'call-1'])
    expect(sliced?.messages[1]?.clarification?.answer).toBe('储户')
    expect(sliced?.pendingToolCallId).toBeUndefined()
  })

  it('resets the clarification and drops later turns', () => {
    const sliced = sliceSessionMessages(thread, 'a1', 'reset')
    expect(sliced?.messages.map((m) => m.id)).toEqual(['u1', 'a1'])
    expect(sliced?.messages[1]?.pending).toBe(true)
    expect(sliced?.messages[1]?.resolution).toBeUndefined()
    expect(sliced?.messages[1]?.clarification?.answer).toBeUndefined()
    expect(sliced?.pendingToolCallId).toBe('call-1')
  })

  it('does not mutate the original thread', () => {
    sliceSessionMessages(thread, 'a1', 'reset')
    expect(thread[1]?.clarification?.answer).toBe('储户')
    expect(thread[1]?.pending).toBe(false)
    expect(thread).toHaveLength(4)
  })
})

describe('forkSessionRecord', () => {
  it('creates a new session id and title without changing the original', () => {
    const original = session(thread)
    const forked = forkSessionRecord(original, 'a1', { mode: 'reset', title: 'ATM（分支）' })
    expect(forked).not.toBeNull()
    expect(forked!.id).not.toBe(original.id)
    expect(forked!.title).toBe('ATM（分支）')
    expect(forked!.messages).toHaveLength(2)
    expect(original.messages).toHaveLength(4)
    expect(original.context.pendingToolCallId).toBe('call-2')
  })
})
