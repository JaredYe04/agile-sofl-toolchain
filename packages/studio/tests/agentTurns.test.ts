import { describe, expect, it } from 'vitest'
import {
  assistantTextVisible,
  groupAgentTurns,
  turnHasWork,
  workDurationMs,
  workDurationParts
} from '../src/renderer/components/workspace/agent/agentTurns'

describe('agent turns', () => {
  it('keeps a later user message with the work that follows it', () => {
    const turns = groupAgentTurns(
      [
        { id: 'u1', role: 'user', content: 'first', timestamp: '2026-01-01T00:00:00.000Z' },
        { id: 'a1', role: 'assistant', content: 'done', timestamp: '2026-01-01T00:00:04.000Z' },
        { id: 'u2', role: 'user', content: 'second', timestamp: '2026-01-01T00:01:00.000Z' },
        {
          id: 'a2',
          role: 'assistant',
          content: '',
          thinking: 'looking',
          toolCalls: [{ id: 't' }],
          streaming: true,
          timestamp: '2026-01-01T00:01:01.000Z'
        }
      ],
      true
    )
    expect(turns).toHaveLength(2)
    expect(turns[1]?.user?.content).toBe('second')
    expect(turns[1]?.live).toBe(true)
    expect(turns[0]?.live).toBe(false)
    expect(turnHasWork(turns[0]!)).toBe(false)
    expect(turnHasWork(turns[1]!)).toBe(true)
  })

  it('does not treat a streaming summary as a second copy of the same message', () => {
    const [turn] = groupAgentTurns(
      [
        { id: 'u', role: 'user', content: 'go', timestamp: '2026-01-01T00:00:00.000Z' },
        {
          id: 'a',
          role: 'assistant',
          content: '先细化 Account',
          streaming: true,
          timestamp: '2026-01-01T00:00:02.000Z'
        }
      ],
      true
    )
    expect(turn?.summaryId).toBe('a')
    expect(turnHasWork(turn!)).toBe(false)
    expect(assistantTextVisible('summary', 'a', turn!.summaryId)).toBe(true)
    expect(assistantTextVisible('work', 'a', turn!.summaryId)).toBe(false)
  })

  it('does not repeat a clarification or the final reply on the work row', () => {
    const [turn] = groupAgentTurns(
      [
        { id: 'u', role: 'user', content: 'go' },
        { id: 'ask', role: 'assistant', content: '下一步先细化哪个切片?', toolCalls: [{ id: 't' }] },
        { id: 'reply', role: 'assistant', content: '先把 Account 模块细化' }
      ],
      true
    )
    expect(turn?.summaryId).toBe('reply')
    expect(assistantTextVisible('work', 'ask', turn!.summaryId, { pinned: true, hideText: true })).toBe(false)
    expect(assistantTextVisible('summary', 'ask', turn!.summaryId, { pinned: true, hideText: true })).toBe(false)
    expect(assistantTextVisible('work', 'reply', turn!.summaryId, { pinned: true })).toBe(false)
    expect(assistantTextVisible('summary', 'reply', turn!.summaryId, { pinned: true })).toBe(true)
  })

  it('measures a finished turn from its timestamps', () => {
    const [turn] = groupAgentTurns(
      [
        { id: 'u', role: 'user', content: 'go', timestamp: '2026-01-01T00:00:00.000Z' },
        { id: 'a', role: 'assistant', content: 'ok', timestamp: '2026-01-01T00:01:05.000Z' }
      ],
      false
    )
    expect(workDurationMs(turn!, Date.parse('2026-01-01T00:10:00.000Z'))).toBe(65_000)
    expect(workDurationParts(65_000)).toEqual({ h: 0, m: 1, s: 5 })
  })
})
