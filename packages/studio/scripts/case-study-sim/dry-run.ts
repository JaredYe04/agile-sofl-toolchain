import { randomBytes } from 'node:crypto'

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const usage = { model: 'dry-run', choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }

/**
 * Local fake ChatECNU stream. No network. Proposes one Informal write, then one Hybrid
 * module add, then stops. Tool JSON is applied by the real agent-loop + apply helpers.
 */
export function installDryRunFetch(delayMs = 0): void {
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages?: Array<{ role: string }>
      tools?: Array<{ function?: { name?: string } }>
    }
    const toolResults = body.messages?.filter((m) => m.role === 'tool').length ?? 0
    const names = (body.tools ?? []).map((t) => t.function?.name).filter(Boolean) as string[]
    const id = `dry-${randomBytes(3).toString('hex')}`
    const canInformal = names.includes('propose_changes')
    const canHybrid = names.includes('propose_hybrid_changes')
    if (toolResults >= 2 || (!canInformal && !canHybrid)) {
      return sse([{ model: 'dry-run', choices: [{ delta: { content: 'dry-run done' }, finish_reason: 'stop' }] }, usage])
    }
    if (canInformal && (toolResults === 0 || !canHybrid)) {
      const args = {
        explanation: 'dry-run informal',
        operations: [
          {
            op: 'add',
            target: 'functions',
            node: { type: 'function', title: 'DryRunScope', description: 'Dry-run function node from local fake LLM.' }
          }
        ]
      }
      return sse([
        {
          model: 'dry-run',
          choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name: 'propose_changes', arguments: JSON.stringify(args) } }] } }]
        },
        { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        usage
      ])
    }
    const args = {
      explanation: 'dry-run hybrid',
      operations: [{ op: 'add', kind: 'module', name: 'SYSTEM_DryRun' }]
    }
    return sse([
      {
        model: 'dry-run',
        choices: [
          { delta: { tool_calls: [{ index: 0, id, function: { name: 'propose_hybrid_changes', arguments: JSON.stringify(args) } }] } }
        ]
      },
      { model: 'dry-run', choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      usage
    ])
  }) as typeof fetch
}
