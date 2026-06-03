import { describe, it, expect } from 'vitest'
import { parseMessages, frameMessage } from '../src/main/lspFraming'

describe('LSP framing', () => {
  it('frames and parses a JSON-RPC message', () => {
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 })
    const framed = frameMessage(body)
    const { messages, rest } = parseMessages(framed)
    expect(messages).toHaveLength(1)
    expect(JSON.parse(messages[0])).toEqual({ jsonrpc: '2.0', method: 'initialize', id: 1 })
    expect(rest).toBe('')
  })

  it('buffers partial messages', () => {
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 2 })
    const framed = frameMessage(body)
    const half = framed.slice(0, 20)
    expect(parseMessages(half).messages).toHaveLength(0)
    expect(parseMessages(half + framed.slice(20)).messages).toHaveLength(1)
  })
})
