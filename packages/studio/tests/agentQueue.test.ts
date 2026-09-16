import { describe, expect, it } from 'vitest'
import {
  composerAction,
  createQueuedMessage,
  enqueueMessage,
  removeQueuedMessage,
  shiftQueuedMessage,
  updateQueuedMessage
} from '../src/renderer/components/workspace/agent/agentQueue'

describe('agent message queue', () => {
  it('uses enqueue while busy with input, stop when busy and empty, send otherwise', () => {
    expect(composerAction(true, 'follow up')).toBe('enqueue')
    expect(composerAction(true, '  ')).toBe('stop')
    expect(composerAction(false, 'hello')).toBe('send')
  })

  it('drops blank enqueue and trims stored text', () => {
    expect(createQueuedMessage('   ')).toBeNull()
    expect(createQueuedMessage('  keep  ')?.text).toBe('keep')
    expect(enqueueMessage([], '  next  ')).toEqual([{ id: expect.any(String), text: 'next' }])
  })

  it('edits, deletes empty edits, and shifts in order', () => {
    const a = createQueuedMessage('one', 'a')!
    const b = createQueuedMessage('two', 'b')!
    const edited = updateQueuedMessage([a, b], 'a', '  one*  ')
    expect(edited).toEqual([
      { id: 'a', text: 'one*' },
      { id: 'b', text: 'two' }
    ])
    expect(updateQueuedMessage(edited, 'b', '   ')).toEqual([{ id: 'a', text: 'one*' }])
    expect(removeQueuedMessage(edited, 'a').map((i) => i.id)).toEqual(['b'])
    expect(shiftQueuedMessage(edited)).toEqual({
      next: { id: 'a', text: 'one*' },
      rest: [{ id: 'b', text: 'two' }]
    })
  })
})
