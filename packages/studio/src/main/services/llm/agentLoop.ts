import { chatEcnuStream, type ChatMessage } from './chatEcnu'
import { AGENT_TOOLS, skillById } from './skills'
import type { AgentMessage, AgentSession, InformalPatchPayload } from './agentTypes'
import { newId } from './agentTypes'
import { saveSession } from './sessionStore'
import { informalInventoryFromMarkdown } from '@agile-sofl/aspec/dist/informal/inventory.js'

const MAX_HISTORY = 20

export type AgentTurnContext = {
  projectName?: string
  moduleId?: string
  informalMarkdown: string
  selectedNodeId?: string
  selectedNodeSummary?: string
  skillId?: string
}

export type AgentStreamEvent =
  | { kind: 'session'; session: AgentSession }
  | { kind: 'reasoning'; messageId: string; text: string }
  | { kind: 'content'; messageId: string; text: string }

export type AgentStreamSink = (event: AgentStreamEvent) => void

function compactSpec(markdown: string): string {
  return informalInventoryFromMarkdown(markdown, 12000)
}

function systemPrompt(ctx: AgentTurnContext): string {
  const skill = skillById(ctx.skillId)
  return `You are the Agile-SOFL Specification Agent inside Studio.
You help users build an Informal Specification with a fixed schema:
# Functions
# Data Resources
# Constraints

Markdown is only a view. You MUST NOT output a full markdown document to apply.
You MUST use tools:
- ask_clarification: when you need a decision (render options the user can click)
- read_specification: when you need ids of existing items before editing
- propose_changes: when ready to add, update, remove, or move nodes (preview + user confirm)
- review_specification: for quality review

Never claim you already modified the file. The editor applies patches only after the user clicks Apply.
After the user applies or rejects a patch, stop and wait for their next message. Do not immediately propose more changes.
After an ask_clarification tool result, you MUST continue: call ask_clarification again or propose_changes. Never return an empty message.

For propose_changes, operate on the CURRENT inventory below (ids like fn-login, dr-account, c-unique):
- add: target = functions | data-resources | constraints (or a parent node id). node.type = function | data-resource | data-field | constraint. Include title and description.
- update: id = existing node id (or unique title). Set title and/or description. Use this to revise existing items.
- remove: id = existing node id. Use this to delete obsolete items.
- move: id + parentId + optional afterId.
Prefer update/remove on existing nodes over adding a second copy of the same idea.
Do not invent YAML frontmatter or document-level metadata.

Active skill: ${skill.name}
${skill.prompt}

Current project: ${ctx.projectName ?? 'unknown'}
Current module: ${ctx.moduleId ?? 'project'}
Selected node: ${ctx.selectedNodeSummary || ctx.selectedNodeId || '(none — stay focused on selection when present)'}

Current Informal Specification inventory:
${compactSpec(ctx.informalMarkdown)}
`
}

function toApiMessages(
  session: AgentSession,
  ctx: AgentTurnContext,
  options?: { continuation?: boolean }
): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: systemPrompt(ctx) }]
  const toolResults = new Map<string, AgentMessage>()
  for (const m of session.messages) {
    if (m.role === 'tool') toolResults.set(m.id, m)
  }

  const body: ChatMessage[] = []
  for (const m of session.messages) {
    if (m.role === 'system' || m.role === 'tool') continue
    if (m.role === 'user') {
      body.push({ role: 'user', content: m.content })
      continue
    }
    if (m.role !== 'assistant') continue
    const toolCalls = m.toolCalls ?? []
    if (toolCalls.length) {
      const results = toolCalls.map((call) => toolResults.get(call.id))
      if (results.some((result) => !result)) continue
      const assistant: ChatMessage = {
        role: 'assistant',
        content: m.content || null,
        tool_calls: toolCalls.map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: c.arguments }
        })),
        reasoning_content: m.thinking ?? ''
      }
      body.push(assistant)
      for (const call of toolCalls) {
        body.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResults.get(call.id)!.content
        })
      }
      continue
    }
    if (m.content.trim() || m.thinking?.trim()) {
      body.push({ role: 'assistant', content: m.content })
    }
  }

  const startIndexes = new Set<number>()
  for (let i = 0; i < body.length; i++) {
    const msg = body[i]!
    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      startIndexes.add(i)
      let j = i + 1
      while (j < body.length && body[j]?.role === 'tool') {
        startIndexes.add(j)
        j += 1
      }
    }
  }
  for (let i = Math.max(0, body.length - MAX_HISTORY); i < body.length; i++) startIndexes.add(i)
  const trimmed = body.filter((_, i) => startIndexes.has(i))
  msgs.push(...trimmed)
  if (options?.continuation) {
    msgs.push({
      role: 'user',
      content:
        'Continue now. Call ask_clarification for the next decision, or propose_changes if you have enough detail. Do not reply with an empty message.'
    })
  }
  return msgs
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function validatePatch(_source: string, patch: InformalPatchPayload): { ok: boolean; message: string } {
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    return { ok: false, message: 'Patch has no operations.' }
  }
  return { ok: true, message: 'Patch will be schema-validated when applied.' }
}

function emit(sink: AgentStreamSink | undefined, event: AgentStreamEvent): void {
  sink?.(event)
}

export async function runAgentTurn(
  session: AgentSession,
  projectRoot: string,
  ctx: AgentTurnContext,
  userText?: string,
  sink?: AgentStreamSink
): Promise<AgentSession> {
  if (userText?.trim()) {
    session.messages.push({
      id: newId('msg'),
      role: 'user',
      content: userText.trim(),
      timestamp: new Date().toISOString(),
      skillId: ctx.skillId
    })
    if (session.title === 'Requirement Analysis' && session.messages.filter((m) => m.role === 'user').length === 1) {
      session.title = userText.trim().slice(0, 42)
    }
    saveSession(projectRoot, session)
    emit(sink, { kind: 'session', session })
  }
  session.context.skillId = ctx.skillId || session.context.skillId || 'requirement-discovery'
  session.context.selectedNodeId = ctx.selectedNodeId
  const continuation = !userText?.trim()

  for (let step = 0; step < 6; step++) {
    const assistantId = newId('msg')
    const live: AgentMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      thinking: '',
      streaming: true,
      timestamp: new Date().toISOString(),
      skillId: ctx.skillId
    }
    session.messages.push(live)
    emit(sink, { kind: 'session', session })

    const history = { ...session, messages: session.messages.filter((m) => m.id !== assistantId) }
    const request = {
      messages: toApiMessages(history, ctx, { continuation: continuation && step === 0 }),
      tools: AGENT_TOOLS,
      temperature: 0.35
    }

    let completion
    try {
      completion = await chatEcnuStream({
        ...request,
        thinking: true,
        onDelta: (delta) => {
          if (delta.reasoning != null) {
            live.thinking = delta.reasoning
            emit(sink, { kind: 'reasoning', messageId: assistantId, text: delta.reasoning })
          }
          if (delta.content != null) {
            live.content = delta.content
            emit(sink, { kind: 'content', messageId: assistantId, text: delta.content })
          }
        }
      })
    } catch {
      try {
        completion = await chatEcnuStream({
          ...request,
          thinking: false,
          onDelta: (delta) => {
            if (delta.content != null) {
              live.content = delta.content
              emit(sink, { kind: 'content', messageId: assistantId, text: delta.content })
            }
          }
        })
      } catch (err) {
        live.streaming = false
        live.content = err instanceof Error ? err.message : String(err)
        saveSession(projectRoot, session)
        emit(sink, { kind: 'session', session })
        throw err
      }
    }

    live.streaming = false
    live.content = completion.content.trim()
    live.thinking = completion.reasoning.trim() || live.thinking
    if (completion.toolCalls.length) {
      live.toolCalls = completion.toolCalls.map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments
      }))
    }

    if (completion.toolCalls.length) {
      for (const call of completion.toolCalls) {
        const args = parseArgs(call.function.arguments || '{}')
        if (call.function.name === 'ask_clarification') {
          const options = Array.isArray(args.options)
            ? (args.options as Array<{ id?: string; label?: string }>)
                .filter((o) => o.label)
                .map((o, i) => ({ id: o.id || `opt-${i}`, label: String(o.label) }))
            : undefined
          live.content = String(args.question || live.content || '')
          live.clarification = {
            id: newId('q'),
            question: String(args.question || 'Please clarify.'),
            options,
            allowCustom: args.allowCustom !== false,
            multiSelect: Boolean(args.multiSelect),
            pendingToolCallId: call.id
          }
          live.pending = true
          session.context.pendingToolCallId = call.id
          completeSiblingToolCalls(session, completion.toolCalls, call.id)
          saveSession(projectRoot, session)
          emit(sink, { kind: 'session', session })
          return session
        }
        if (call.function.name === 'propose_changes') {
          const patch: InformalPatchPayload = {
            explanation: typeof args.explanation === 'string' ? args.explanation : undefined,
            operations: Array.isArray(args.operations)
              ? (args.operations as Array<Record<string, unknown>>)
              : []
          }
          const validity = validatePatch(ctx.informalMarkdown, patch)
          live.content =
            patch.explanation ||
            live.content ||
            (validity.ok ? 'Proposed specification changes.' : `Patch failed validation: ${validity.message}`)
          live.proposedChanges = validity.ok ? patch : undefined
          live.pending = true
          session.context.pendingToolCallId = call.id
          completeSiblingToolCalls(session, completion.toolCalls, call.id)
          saveSession(projectRoot, session)
          emit(sink, { kind: 'session', session })
          return session
        }
        if (call.function.name === 'read_specification') {
          const inventory = informalInventoryFromMarkdown(ctx.informalMarkdown)
          session.messages.push({
            id: call.id,
            role: 'tool',
            content: JSON.stringify({ ok: true, inventory }),
            timestamp: new Date().toISOString()
          })
          live.content = live.content || 'Read the current Informal Specification inventory.'
          continue
        }
        if (call.function.name === 'review_specification') {
          const typedIssues = Array.isArray(args.issues)
            ? (args.issues as Array<{ dimension?: string; message?: string; nodeId?: string }>).map((i) => ({
                dimension: String(i.dimension || 'completeness'),
                message: String(i.message || ''),
                nodeId: i.nodeId
              }))
            : []
          live.content = live.content || 'Specification review'
          live.review = { issues: typedIssues }
          session.messages.push({
            id: call.id,
            role: 'tool',
            content: JSON.stringify({ ok: true, issues: typedIssues }),
            timestamp: new Date().toISOString()
          })
          continue
        }
        session.messages.push({
          id: call.id,
          role: 'tool',
          content: JSON.stringify({ ok: false, error: `Unknown tool ${call.function.name}` }),
          timestamp: new Date().toISOString()
        })
      }
      saveSession(projectRoot, session)
      emit(sink, { kind: 'session', session })
      continue
    }

    if (!live.content && !live.thinking) {
      if (continuation && step === 0) {
        live.content = '已收到你的回答。请直接发下一条消息，告诉我继续补充需求，或让我把已确认的内容写入规格。'
      } else {
        session.messages = session.messages.filter((m) => m.id !== assistantId)
      }
    }
    break
  }

  saveSession(projectRoot, session)
  emit(sink, { kind: 'session', session })
  return session
}

function completeSiblingToolCalls(
  session: AgentSession,
  calls: Array<{ id: string }>,
  keepId: string
): void {
  for (const call of calls) {
    if (call.id === keepId) continue
    if (session.messages.some((m) => m.role === 'tool' && m.id === call.id)) continue
    session.messages.push({
      id: call.id,
      role: 'tool',
      content: JSON.stringify({ skipped: true, reason: 'Paused for a user decision on another tool.' }),
      timestamp: new Date().toISOString()
    })
  }
}

function parseResumePayload(result: string): { action?: string } {
  try {
    const parsed = JSON.parse(result) as { action?: string }
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* plain text from older clients */
  }
  return {}
}

export async function resumeWithToolResult(
  session: AgentSession,
  projectRoot: string,
  ctx: AgentTurnContext,
  toolCallId: string,
  result: string,
  sink?: AgentStreamSink,
  continueTurn = true
): Promise<AgentSession> {
  const payload = parseResumePayload(result)
  for (const m of session.messages) {
    if (!m.pending) continue
    if (m.clarification?.pendingToolCallId === toolCallId || session.context.pendingToolCallId === toolCallId) {
      m.pending = false
      if (m.clarification) {
        m.clarification.answer = result
        m.resolution = 'answered'
      }
      if (m.proposedChanges) {
        m.resolution = payload.action === 'applied' ? 'applied' : 'rejected'
      }
    }
  }
  session.messages.push({
    id: toolCallId,
    role: 'tool',
    content: payload.action
      ? result
      : JSON.stringify({
          type: 'clarification_answer',
          answer: result,
          next: 'Continue with ask_clarification or propose_changes. Do not stop with an empty message.'
        }),
    timestamp: new Date().toISOString()
  })
  session.context.pendingToolCallId = undefined
  saveSession(projectRoot, session)
  emit(sink, { kind: 'session', session })
  if (!continueTurn) return session
  return runAgentTurn(session, projectRoot, ctx, undefined, sink)
}
