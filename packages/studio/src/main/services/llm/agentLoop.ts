import { chatEcnuStream, isChatAborted, type ChatMessage } from './chatEcnu'
import { AGENT_TOOLS, skillById } from './skills'
import type { AgentMessage, AgentSession, InformalPatchPayload } from './agentTypes'
import { newId, normalizePermissions, type AgentSpecPermissions } from './agentTypes'
import { saveSession } from './sessionStore'
import { informalInventoryFromMarkdown } from '@agile-sofl/aspec/dist/informal/inventory.js'
import { formatHybridInventory } from '@agile-sofl/editor-api'
import { numberedSource } from '../../../shared/sourceEdit.js'
import {
  appliedToolResult,
  continuationUserText,
  consecutiveWriteFailures,
  crudBlockedByFailures,
  failedToolResult,
  nextFailedWrite,
  patchFingerprint,
  rejectedToolResult,
  validateAgentPatch
} from './agentPatch'

const MAX_HISTORY = 20

export type AgentTurnContext = {
  projectName?: string
  moduleId?: string
  informalMarkdown: string
  hybridAsfl?: string
  selectedNodeId?: string
  selectedNodeSummary?: string
  skillId?: string
  permissions?: AgentSpecPermissions
  promptExtras?: string
}

export type AgentStreamEvent =
  | { kind: 'session'; session: AgentSession }
  | { kind: 'reasoning'; messageId: string; text: string }
  | { kind: 'content'; messageId: string; text: string }

export type AgentStreamSink = (event: AgentStreamEvent) => void

function permissionsOf(session: AgentSession, ctx: AgentTurnContext): AgentSpecPermissions {
  return normalizePermissions(ctx.permissions ?? session.context.permissions)
}

function toolsFor(permissions: AgentSpecPermissions) {
  return AGENT_TOOLS.filter((tool) => {
    const name = tool.function.name
    if (name === 'ask_clarification') return true
    if (name === 'read_specification' || name === 'review_specification') return permissions.informal.read
    if (name === 'propose_changes') return permissions.informal.write
    if (name === 'read_hybrid_specification' || name === 'review_hybrid') return permissions.hybrid.read
    if (name === 'propose_hybrid_changes') return permissions.hybrid.write
    if (name === 'propose_source_edit') return permissions.informal.write || permissions.hybrid.write
    return true
  })
}

function compactSpec(markdown: string): string {
  return informalInventoryFromMarkdown(markdown, 12000)
}

function compactHybrid(asfl: string | undefined): string {
  if (!asfl?.trim()) return '(empty hybrid specification)'
  return formatHybridInventory(asfl, 12000)
}

function systemPrompt(ctx: AgentTurnContext, permissions: AgentSpecPermissions): string {
  const skill = skillById(ctx.skillId)
  const toolLines: string[] = ['- ask_clarification: when you need a decision (render options the user can click)']
  if (permissions.informal.read) {
    toolLines.push('- read_specification: Informal inventory (default) or numbered source (view=source)')
    toolLines.push('- review_specification: Informal quality review')
  }
  if (permissions.informal.write) {
    toolLines.push('- propose_changes: Informal add/update/remove/move (preferred)')
  }
  if (permissions.hybrid.read) {
    toolLines.push('- read_hybrid_specification: Hybrid inventory (default) or numbered .asfl (view=source)')
    toolLines.push('- review_hybrid: Hybrid quality review')
  }
  if (permissions.hybrid.write) {
    toolLines.push('- propose_hybrid_changes: incremental Hybrid CRUD (preferred)')
  }
  if (permissions.informal.write || permissions.hybrid.write) {
    toolLines.push(
      '- propose_source_edit: last-resort Informal/Hybrid source edit (replace/append/replace-document) when CRUD cannot unstick'
    )
  }

  const informalGuide = permissions.informal.write
    ? `For propose_changes, operate on the CURRENT Informal inventory (ids like fn-login, dr-account, c-unique):
- add: target = functions | data-resources | constraints (or a parent node id). node.type = function | data-resource | data-field | constraint. Include title and description.
- update: id = existing node id (or unique title). Set title and/or description.
- remove: id = existing node id.
- move: id + parentId + optional afterId.
Prefer update/remove on existing nodes over adding a second copy of the same idea.
Do not invent YAML frontmatter or document-level metadata.`
    : 'You do not have Informal write permission. Do not call propose_changes.'

  const hybridGuide = permissions.hybrid.write
    ? `For propose_hybrid_changes, operate on Hybrid inventory ids with CRUD only:
- add: kind (module|type|var|const|inv|process|function|scenario|gui-screen) + parentId (mod:Module or proc:Module.Name) + name. Bare ids like proc:Login or Chinese titles are resolved when possible, but prefer inventory ids. Types/vars/invs use text. Processes use pre/post/signature — NEVER FSF :.
- update / remove: id of existing entity (mod:, proc:, type:, var:, inv:, scn:, gui:).
- replace-process-body: id of proc:, set pre and/or post (structured NL or predicate).
FORBIDDEN: replace-document, asflText, dumping several modules as one string, "-- comments" as source.
Add one module at a time, then its types/vars/invs/processes as separate operations. Prefer updating an existing id over adding a duplicate.
Never put end_module, a whole module, or a process block inside type/var/inv/pre/post text — that wipes the document.
After a write is applied, call read_hybrid_specification and keep patching until the inventory matches the plan.`
    : 'You do not have Hybrid write permission. Do not call propose_hybrid_changes.'

  const sourceGuide =
    permissions.informal.write || permissions.hybrid.write
      ? `propose_source_edit is an escape hatch, not the default:
- Prefer propose_changes / propose_hybrid_changes for almost every write.
- Use source edit after CRUD fails, when inventory is empty/out of sync with the file, or when you must fix text CRUD cannot express.
- First call read_* with view=source. Then replace a UNIQUE oldText snippet, append, or replace-document.
- Do not retry the same failing CRUD patch. After two CRUD failures you MUST switch to propose_source_edit.`
      : 'You do not have write permission for source edits.'

  const informalBlock = permissions.informal.read
    ? `Current Informal Specification inventory:\n${compactSpec(ctx.informalMarkdown)}`
    : 'Informal Specification: (read permission off)'
  const hybridBlock = permissions.hybrid.read
    ? `Current Hybrid Specification inventory:\n${compactHybrid(ctx.hybridAsfl)}`
    : 'Hybrid Specification: (read permission off)'

  return `You are the Agile-SOFL Specification Agent inside Studio.
You help users build Informal Specification and/or Hybrid Specification (.asfl).
Markdown and SOFL text are views. You MUST NOT output a full document to apply.
You MUST use tools:
${toolLines.join('\n')}

Never claim you already modified the file. Writes go through propose_* tools. User Apply/Reject (or auto-write) is only a tool result — you MUST continue the same task.
After any applied write, call read_specification and/or read_hybrid_specification, verify, and propose another patch if anything is missing or wrong. Repeat until correct.
When the whole task is done, your LAST message is a short summary of what was completed. Do not wait for the user to say "continue".
Prefer structured CRUD. Do not dump raw Markdown or raw SOFL through propose_changes / propose_hybrid_changes. If those tools fail or cannot express the fix, read view=source and use propose_source_edit.

${informalGuide}

${hybridGuide}

${sourceGuide}

Active skill: ${skill.name}
${skill.prompt}

Current project: ${ctx.projectName ?? 'unknown'}
Current module: ${ctx.moduleId ?? 'project'}
Selected node: ${ctx.selectedNodeSummary || ctx.selectedNodeId || '(none — stay focused on selection when present)'}
Session permissions: Informal r=${permissions.informal.read} w=${permissions.informal.write}; Hybrid r=${permissions.hybrid.read} w=${permissions.hybrid.write}

${ctx.promptExtras ? `${ctx.promptExtras}\n` : ''}
${informalBlock}

${hybridBlock}
`
}

function toApiMessages(
  session: AgentSession,
  ctx: AgentTurnContext,
  permissions: AgentSpecPermissions,
  options?: { continuation?: boolean }
): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: systemPrompt(ctx, permissions) }]
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
    const lastTool = [...session.messages].reverse().find((m) => m.role === 'tool')
    const toolContents = session.messages.filter((m) => m.role === 'tool').map((m) => m.content)
    const failures = Math.max(
      consecutiveWriteFailures(toolContents),
      session.context.lastFailedWrite?.count ?? 0
    )
    msgs.push({
      role: 'user',
      content: continuationUserText(lastTool?.content, failures)
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

function emit(sink: AgentStreamSink | undefined, event: AgentStreamEvent): void {
  sink?.(event)
}

export async function runAgentTurn(
  session: AgentSession,
  projectRoot: string,
  ctx: AgentTurnContext,
  userText?: string,
  sink?: AgentStreamSink,
  signal?: AbortSignal
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
  const permissions = permissionsOf(session, ctx)
  session.context.permissions = permissions
  if (ctx.promptExtras) session.context.promptExtras = ctx.promptExtras
  else ctx.promptExtras = session.context.promptExtras
  ctx.permissions = permissions
  const continuation = !userText?.trim()

  const stopIfAborted = (): boolean => {
    if (!signal?.aborted) return false
    const live = [...session.messages].reverse().find((m) => m.role === 'assistant' && m.streaming)
    if (live) {
      live.streaming = false
      if (!live.content.trim()) live.content = '已停止 / Stopped.'
    } else {
      session.messages.push({
        id: newId('msg'),
        role: 'assistant',
        content: '已停止 / Stopped.',
        timestamp: new Date().toISOString(),
        skillId: ctx.skillId
      })
    }
    saveSession(projectRoot, session)
    emit(sink, { kind: 'session', session })
    return true
  }

  for (let step = 0; step < 14; step++) {
    if (stopIfAborted()) return session
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
      messages: toApiMessages(history, ctx, permissions, { continuation: continuation && step === 0 }),
      tools: toolsFor(permissions),
      temperature: 0.35
    }

    let completion
    try {
      completion = await chatEcnuStream({
        ...request,
        thinking: true,
        signal,
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
    } catch (first) {
      if (isChatAborted(first) || signal?.aborted) {
        live.streaming = false
        if (!live.content.trim()) live.content = '已停止 / Stopped.'
        saveSession(projectRoot, session)
        emit(sink, { kind: 'session', session })
        return session
      }
      try {
        completion = await chatEcnuStream({
          ...request,
          thinking: false,
          signal,
          onDelta: (delta) => {
            if (delta.content != null) {
              live.content = delta.content
              emit(sink, { kind: 'content', messageId: assistantId, text: delta.content })
            }
          }
        })
      } catch (err) {
        live.streaming = false
        if (isChatAborted(err) || signal?.aborted) {
          if (!live.content.trim()) live.content = '已停止 / Stopped.'
          saveSession(projectRoot, session)
          emit(sink, { kind: 'session', session })
          return session
        }
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
        if (
          call.function.name === 'propose_changes' ||
          call.function.name === 'propose_hybrid_changes' ||
          call.function.name === 'propose_source_edit'
        ) {
          const mode: 'crud' | 'source' =
            call.function.name === 'propose_source_edit' ? 'source' : 'crud'
          let target: 'informal' | 'hybrid'
          if (call.function.name === 'propose_hybrid_changes') target = 'hybrid'
          else if (call.function.name === 'propose_changes') target = 'informal'
          else {
            const raw = typeof args.target === 'string' ? args.target : ''
            if (raw === 'hybrid' || raw === 'informal') {
              target = raw
            } else if (permissions.hybrid.write && !permissions.informal.write) {
              target = 'hybrid'
            } else if (permissions.informal.write && !permissions.hybrid.write) {
              target = 'informal'
            } else {
              session.messages.push({
                id: call.id,
                role: 'tool',
                content: JSON.stringify({
                  ok: false,
                  error: 'propose_source_edit requires target: "informal" or "hybrid".',
                  next: 'Re-call propose_source_edit with an explicit target after read_* view=source.'
                }),
                timestamp: new Date().toISOString()
              })
              live.content = live.content || 'Source edit needs an explicit target.'
              continue
            }
          }
          const patch: InformalPatchPayload = {
            target,
            mode,
            explanation: typeof args.explanation === 'string' ? args.explanation : undefined,
            operations: Array.isArray(args.operations)
              ? (args.operations as Array<Record<string, unknown>>)
              : []
          }
          const allowed = target === 'hybrid' ? permissions.hybrid.write : permissions.informal.write
          if (!allowed) {
            session.messages.push({
              id: call.id,
              role: 'tool',
              content: JSON.stringify({
                ok: false,
                error: `No ${target} write permission.`,
                next: 'Do not call write tools for a specification you cannot write.'
              }),
              timestamp: new Date().toISOString()
            })
            live.content = live.content || `No ${target} write permission.`
            continue
          }
          const blocked = crudBlockedByFailures(session.context.lastFailedWrite, {
            fingerprint: patchFingerprint(patch),
            mode
          })
          if (blocked) {
            session.context.lastFailedWrite = nextFailedWrite(session.context.lastFailedWrite, {
              fingerprint: patchFingerprint(patch),
              error: blocked,
              mode
            })
            session.messages.push({
              id: call.id,
              role: 'tool',
              content: JSON.stringify({
                ok: false,
                error: blocked,
                next: 'Do not retry the same CRUD. Call read_* with view=source, then propose_source_edit.'
              }),
              timestamp: new Date().toISOString()
            })
            live.content = live.content || `Patch rejected: ${blocked}`
            continue
          }
          const validity = validateAgentPatch(target, patch, { mode })
          if (!validity.ok) {
            session.context.lastFailedWrite = nextFailedWrite(session.context.lastFailedWrite, {
              fingerprint: patchFingerprint(patch),
              error: validity.message,
              mode
            })
            session.messages.push({
              id: call.id,
              role: 'tool',
              content: JSON.stringify({
                ok: false,
                error: validity.message,
                next:
                  mode === 'source'
                    ? 'Fix the source-edit operations (unique oldText, or append / replace-document). Do not stop.'
                    : 'Tool rejected that patch. Read the inventory, or view=source then propose_source_edit. Do not stop.'
              }),
              timestamp: new Date().toISOString()
            })
            live.content = live.content || `Patch rejected: ${validity.message}`
            continue
          }
          live.content =
            patch.explanation ||
            live.content ||
            (mode === 'source'
              ? `Proposed ${target} source edit.`
              : `Proposed ${target} specification changes.`)
          live.proposedChanges = patch
          live.pending = true
          session.context.pendingToolCallId = call.id
          completeSiblingToolCalls(session, completion.toolCalls, call.id)
          saveSession(projectRoot, session)
          emit(sink, { kind: 'session', session })
          return session
        }
        if (call.function.name === 'read_specification') {
          const view = args.view === 'source' ? 'source' : 'inventory'
          const body = !permissions.informal.read
            ? '(Informal read permission off)'
            : view === 'source'
              ? numberedSource(ctx.informalMarkdown)
              : informalInventoryFromMarkdown(ctx.informalMarkdown)
          session.messages.push({
            id: call.id,
            role: 'tool',
            content: JSON.stringify({
              ok: permissions.informal.read,
              view,
              inventory: view === 'inventory' ? body : undefined,
              source: view === 'source' ? body : undefined
            }),
            timestamp: new Date().toISOString()
          })
          live.content =
            live.content ||
            (view === 'source'
              ? 'Read the current Informal Specification source.'
              : 'Read the current Informal Specification inventory.')
          continue
        }
        if (call.function.name === 'read_hybrid_specification') {
          const view = args.view === 'source' ? 'source' : 'inventory'
          const body = !permissions.hybrid.read
            ? '(Hybrid read permission off)'
            : view === 'source'
              ? numberedSource(ctx.hybridAsfl ?? '')
              : compactHybrid(ctx.hybridAsfl)
          session.messages.push({
            id: call.id,
            role: 'tool',
            content: JSON.stringify({
              ok: permissions.hybrid.read,
              view,
              inventory: view === 'inventory' ? body : undefined,
              source: view === 'source' ? body : undefined
            }),
            timestamp: new Date().toISOString()
          })
          live.content =
            live.content ||
            (view === 'source'
              ? 'Read the current Hybrid Specification source.'
              : 'Read the current Hybrid Specification inventory.')
          continue
        }
        if (call.function.name === 'review_specification' || call.function.name === 'review_hybrid') {
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
        live.content =
          '继续当前任务：必要时再问一句，或提交下一组修改（CRUD 优先；卡住时用源文件编辑）；若已完成，请给出简短总结。'
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

function parseResumePayload(result: string): { action?: string; error?: string } {
  try {
    const parsed = JSON.parse(result) as { action?: string; error?: string }
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
  continueTurn = true,
  signal?: AbortSignal
): Promise<AgentSession> {
  const payload = parseResumePayload(result)
  const pending = session.messages.find(
    (m) =>
      m.pending &&
      (m.clarification?.pendingToolCallId === toolCallId || session.context.pendingToolCallId === toolCallId)
  )
  const patch = pending?.proposedChanges
  if (patch) {
    if (payload.action === 'applied' && !payload.error) {
      session.context.lastFailedWrite = undefined
    } else if (payload.action === 'error' || (payload.action === 'applied' && payload.error)) {
      session.context.lastFailedWrite = nextFailedWrite(session.context.lastFailedWrite, {
        fingerprint: patchFingerprint(patch),
        error: payload.error || 'Tool failed',
        mode: patch.mode ?? 'crud'
      })
    }
  }
  for (const m of session.messages) {
    if (!m.pending) continue
    if (m.clarification?.pendingToolCallId === toolCallId || session.context.pendingToolCallId === toolCallId) {
      m.pending = false
      if (m.clarification) {
        m.clarification.answer = result
        m.resolution = 'answered'
      }
      if (m.proposedChanges) {
        m.resolution =
          payload.action === 'applied' ? 'applied' : payload.action === 'error' ? 'error' : 'rejected'
        if (payload.error) m.toolError = payload.error
      }
    }
  }
  if (payload.action === 'applied') result = appliedToolResult({ error: payload.error })
  else if (payload.action === 'error') result = failedToolResult(payload.error || 'Tool failed')
  else if (payload.action === 'rejected') result = rejectedToolResult()
  session.messages.push({
    id: toolCallId,
    role: 'tool',
    content: payload.action
      ? result
      : JSON.stringify({
          type: 'clarification_answer',
          answer: result,
          next: 'Continue with ask_clarification or propose_changes / propose_hybrid_changes. If writes are stuck, read view=source and propose_source_edit. After writes, read the spec to verify. Finish with a summary. Do not stop with an empty message.'
        }),
    timestamp: new Date().toISOString()
  })
  session.context.pendingToolCallId = undefined
  saveSession(projectRoot, session)
  emit(sink, { kind: 'session', session })
  if (!continueTurn) return session
  return runAgentTurn(session, projectRoot, ctx, undefined, sink, signal)
}
