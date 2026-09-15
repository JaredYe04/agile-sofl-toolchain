import type { InformalPatchPayload } from './agentTypes'

export function patchFingerprint(patch: {
  target?: string
  mode?: string
  operations?: Array<Record<string, unknown>>
}): string {
  return JSON.stringify({
    target: patch.target ?? '',
    mode: patch.mode ?? 'crud',
    operations: patch.operations ?? []
  })
}

export function validateAgentPatch(
  target: 'informal' | 'hybrid' | 'gui',
  patch: InformalPatchPayload,
  options?: { mode?: 'crud' | 'source' }
): { ok: boolean; message: string } {
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    return { ok: false, message: 'Patch has no operations.' }
  }
  const mode = options?.mode ?? patch.mode ?? 'crud'
  if (mode === 'source') {
    for (const op of patch.operations) {
      const kind = String(op.op || '')
      if (kind === 'replace-document') {
        if (typeof op.text !== 'string' && typeof op.asflText !== 'string') {
          return { ok: false, message: 'replace-document requires text.' }
        }
        continue
      }
      if (kind === 'append') {
        if (typeof op.text !== 'string' || !String(op.text).length) {
          return { ok: false, message: 'append requires text.' }
        }
        continue
      }
      if (kind === 'replace') {
        if (!String(op.oldText ?? op.from ?? '').length) {
          return { ok: false, message: 'replace requires oldText (a unique snippet from the current source).' }
        }
        continue
      }
      return {
        ok: false,
        message: `Unknown source op "${kind}". Use replace, append, or replace-document.`
      }
    }
    return { ok: true, message: 'ok' }
  }
  if (target === 'gui') {
    const allowed = new Set([
      'add',
      'add-screen',
      'remove',
      'remove-screen',
      'add-widget',
      'replace-html',
      'replace-screen-html',
      'insert-html',
      'patch-node',
      'remove-node'
    ])
    for (const op of patch.operations) {
      const kind = String(op.op || '')
      if (!allowed.has(kind)) {
        return {
          ok: false,
          message: `Unknown GUI op "${kind}". Use add-screen, add-widget, replace-html, replace-screen-html, insert-html.`
        }
      }
    }
    return { ok: true, message: 'ok' }
  }
  for (const op of patch.operations) {
    const kind = String(op.op || '')
    if (kind === 'replace-document' || typeof op.asflText === 'string') {
      return {
        ok: false,
        message:
          'replace-document / asflText is not allowed on CRUD. Use add/update/remove, or call propose_source_edit for a source-level fix.'
      }
    }
    const blobs = [op.text, op.pre, op.post, op.comment, op.signature]
    for (const blob of blobs) {
      if (typeof blob !== 'string') continue
      if (/\b(?:module|system)\b[\s\S]{6,}end_module\b/i.test(blob) || /\bend_module\b/i.test(blob)) {
        return {
          ok: false,
          message:
            'Do not put whole modules or end_module in CRUD fields. Add each entity as a separate operation, or call propose_source_edit if you must edit the .asfl text.'
        }
      }
    }
  }
  if (target === 'hybrid') {
    for (const op of patch.operations) {
      const kind = String(op.op || '')
      if (kind === 'add') {
        if (!op.kind) return { ok: false, message: 'Hybrid add requires kind (module, type, var, inv, process, …).' }
        if (op.kind !== 'inv' && !String(op.name ?? '').trim()) {
          return { ok: false, message: 'Hybrid add requires name.' }
        }
      }
      if (
        (kind === 'update' || kind === 'remove' || kind === 'replace-process-body') &&
        !String(op.id ?? '').trim()
      ) {
        return { ok: false, message: `${kind} requires an inventory id.` }
      }
    }
  }
  return { ok: true, message: 'ok' }
}

export type FailedWriteRecord = {
  fingerprint: string
  error: string
  count: number
  mode?: string
}

export function consecutiveWriteFailures(toolContents: string[]): number {
  let n = 0
  for (let i = toolContents.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(toolContents[i] || '{}') as { action?: string; ok?: boolean }
      if (parsed.action === 'error' || parsed.ok === false) n += 1
      else break
    } catch {
      break
    }
  }
  return n
}

export function crudBlockedByFailures(
  lastFailed: FailedWriteRecord | undefined,
  incoming: { fingerprint: string; mode: 'crud' | 'source' }
): string | null {
  if (incoming.mode === 'source') return null
  if (!lastFailed) return null
  if (lastFailed.fingerprint === incoming.fingerprint) {
    return 'This CRUD patch already failed. Do not retry it. Call read_specification and/or read_hybrid_specification with view=source, then propose_source_edit (replace/append/replace-document).'
  }
  if (lastFailed.mode !== 'source' && lastFailed.count >= 2) {
    return 'CRUD has failed repeatedly. Call read_* with view=source, then propose_source_edit to unstick. CRUD is blocked until a source edit is applied.'
  }
  return null
}

export function nextFailedWrite(
  lastFailed: FailedWriteRecord | undefined,
  incoming: { fingerprint: string; error: string; mode: string }
): FailedWriteRecord {
  const count = lastFailed ? lastFailed.count + 1 : 1
  return {
    fingerprint: incoming.fingerprint,
    error: incoming.error,
    count,
    mode: incoming.mode
  }
}

export function continuationUserText(lastToolContent?: string, failures = 0): string {
  let action: string | undefined
  let error: string | undefined
  try {
    const parsed = JSON.parse(lastToolContent || '{}') as { action?: string; error?: string }
    action = parsed.action
    error = parsed.error
  } catch {
    /* plain clarification answer */
  }
  const sourceHint =
    'If CRUD cannot express the fix, call read_* with view=source, then propose_source_edit (replace/append/replace-document). That is allowed.'
  if (action === 'applied') {
    if (error) {
      return `The patch was applied, but some operations failed: ${error}. Immediately call read_specification and/or read_hybrid_specification, fix remaining work with CRUD or ${sourceHint}`
    }
    return 'The patch was applied. Immediately call read_specification and/or read_hybrid_specification, compare with the plan, and either propose the next incremental CRUD patch or write a final summary of what was completed. Do not wait for a new user message.'
  }
  if (action === 'error' || failures >= 2) {
    return `The write failed: ${error || 'unknown error'}. This is a tool result, not a stopped session. Do not retry the same CRUD patch. Call read_specification and/or read_hybrid_specification with view=source, then propose_source_edit to unstick (replace a unique snippet, append, or replace-document). Then verify. Do not stop with an empty message.`
  }
  if (action === 'rejected') {
    return 'The user rejected that patch. Adjust: ask_clarification if needed, propose a smaller CRUD patch, or use propose_source_edit if the file itself is stuck. Do not stop with an empty message.'
  }
  return 'Continue now. Prefer propose_changes / propose_hybrid_changes. If those fail, read source and propose_source_edit. After writes, read the spec to verify. When the task is done, write a short summary and stop. Do not reply with an empty message.'
}

export function appliedToolResult(extra?: { error?: string }): string {
  return JSON.stringify({
    action: 'applied',
    ok: !extra?.error,
    error: extra?.error,
    next: extra?.error
      ? `Some operations failed: ${extra.error}. Read the inventory (and view=source if needed). Follow up with CRUD or propose_source_edit. Do not stop.`
      : 'Call read_specification and/or read_hybrid_specification to verify. If more work remains, propose the next CRUD patch (or propose_source_edit if CRUD cannot express it). If the task is complete, write a short summary and stop.'
  })
}

export function rejectedToolResult(): string {
  return JSON.stringify({
    action: 'rejected',
    ok: false,
    next: 'Revise the plan. Ask if needed, propose a smaller CRUD patch, or propose_source_edit if the file is stuck.'
  })
}

export function failedToolResult(error: string): string {
  return JSON.stringify({
    action: 'error',
    ok: false,
    error,
    next: 'Tool failed. Do not retry the identical CRUD. Read inventory and view=source, then propose_source_edit if needed. Do not stop the task.'
  })
}
