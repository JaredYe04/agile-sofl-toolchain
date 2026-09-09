import { getEcnuConfig } from './profiles'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: ToolCall[]
  reasoning_content?: string
}

export type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ChatTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ChatCompletion = {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
  finishReason: string
}

export type ChatStreamDelta = {
  reasoning?: string
  content?: string
}

const CHAT_TIMEOUT_MS = 90_000

async function postChat(body: Record<string, unknown>): Promise<Response> {
  const cfg = getEcnuConfig()
  if (!cfg.apiKey) {
    throw new Error('No LLM API key. Add a profile in Settings, or set ECNU_API_KEY in packages/studio/.env.')
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({ model: cfg.model, ...body }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS)
  }).catch((e: unknown) => {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error('ChatECNU timed out after 90s. Send again to continue.')
    }
    throw e
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ChatECNU ${res.status}: ${text.slice(0, 400)}`)
  }
  return res
}

export async function chatEcnu(options: {
  messages: ChatMessage[]
  tools?: ChatTool[]
  temperature?: number
  json?: boolean
}): Promise<ChatCompletion> {
  const body: Record<string, unknown> = {
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    stream: false,
    thinking: { type: 'disabled' }
  }
  if (options.tools?.length) body.tools = options.tools
  if (options.json) body.response_format = { type: 'json_object' }

  const res = await postChat(body)
  const json = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string
      message?: {
        content?: string | null
        reasoning_content?: string | null
        tool_calls?: ToolCall[]
      }
    }>
  }
  const choice = json.choices?.[0]
  return {
    content: choice?.message?.content ?? '',
    reasoning: choice?.message?.reasoning_content ?? '',
    toolCalls: choice?.message?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? 'stop'
  }
}

export async function chatEcnuStream(options: {
  messages: ChatMessage[]
  tools?: ChatTool[]
  temperature?: number
  thinking?: boolean
  onDelta?: (delta: ChatStreamDelta) => void
}): Promise<ChatCompletion> {
  const body: Record<string, unknown> = {
    messages: options.messages,
    temperature: options.temperature ?? 0.35,
    stream: true,
    thinking: { type: options.thinking === false ? 'disabled' : 'enabled' }
  }
  if (options.thinking !== false) body.reasoning_effort = 'low'
  if (options.tools?.length) body.tools = options.tools

  const res = await postChat(body)
  if (!res.body) throw new Error('ChatECNU stream has no body.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoning = ''
  const tools: Array<{ id: string; name: string; arguments: string }> = []
  let finishReason = 'stop'

  const flushLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return
    let parsed: {
      choices?: Array<{
        finish_reason?: string | null
        delta?: {
          content?: string | null
          reasoning_content?: string | null
          reasoning?: string | null
          tool_calls?: Array<{
            index?: number
            id?: string
            function?: { name?: string; arguments?: string }
          }>
        }
      }>
    }
    try {
      parsed = JSON.parse(data) as typeof parsed
    } catch {
      return
    }
    const choice = parsed.choices?.[0]
    if (!choice) return
    if (choice.finish_reason) finishReason = choice.finish_reason
    const delta = choice.delta
    if (!delta) return
    const reasonChunk = delta.reasoning_content ?? delta.reasoning ?? ''
    const contentChunk = delta.content ?? ''
    if (reasonChunk) {
      reasoning += reasonChunk
      options.onDelta?.({ reasoning })
    }
    if (contentChunk) {
      content += contentChunk
      options.onDelta?.({ content })
    }
    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? tools.length
      const current = tools[index] ?? { id: '', name: '', arguments: '' }
      if (call.id) current.id = call.id
      if (call.function?.name) current.name += call.function.name
      if (call.function?.arguments) current.arguments += call.function.arguments
      tools[index] = current
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) flushLine(line)
  }
  if (buffer.trim()) flushLine(buffer)

  return {
    content,
    reasoning,
    toolCalls: tools
      .filter((t) => t.name)
      .map((t) => ({
        id: t.id || `call-${t.name}`,
        type: 'function' as const,
        function: { name: t.name, arguments: t.arguments || '{}' }
      })),
    finishReason
  }
}

export function hasEcnuKey(): boolean {
  return Boolean(getEcnuConfig().apiKey)
}
