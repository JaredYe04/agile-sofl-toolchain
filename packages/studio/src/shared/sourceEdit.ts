export type SourceEditOp = {
  op: string
  oldText?: string
  newText?: string
  text?: string
  asflText?: string
  from?: string
  to?: string
  all?: boolean
}

export function isSourcePatch(patch: {
  mode?: string
  operations?: Array<Record<string, unknown>>
}): boolean {
  if (patch.mode === 'source') return true
  const ops = patch.operations ?? []
  if (!ops.length) return false
  return ops.every((op) => {
    const kind = String(op.op || '')
    return kind === 'replace' || kind === 'append' || kind === 'replace-document'
  })
}

export function numberedSource(text: string, maxChars = 16000): string {
  if (!text.trim()) return '(empty file)'
  const body = text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}| ${line}`)
    .join('\n')
  if (body.length <= maxChars) return body
  return `${body.slice(0, maxChars)}\n…(truncated)`
}

function clip(text: string, n: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= n) return compact
  return `${compact.slice(0, Math.max(0, n - 1))}…`
}

export function applySourceEdits(
  source: string,
  operations: Array<Record<string, unknown>>
): { content: string; error?: string; applied: boolean } {
  let content = source
  const warnings: string[] = []
  for (const op of operations) {
    const kind = String(op.op || '')
    if (kind === 'replace-document') {
      content = String(op.text ?? op.asflText ?? '')
      continue
    }
    if (kind === 'append') {
      const text = String(op.text ?? '')
      if (!text) {
        warnings.push('append requires text.')
        continue
      }
      content = content.trimEnd() ? `${content.trimEnd()}\n${text}` : text
      continue
    }
    if (kind === 'replace') {
      const oldText = String(op.oldText ?? op.from ?? '')
      const newText = String(op.newText ?? op.to ?? '')
      if (!oldText) {
        warnings.push('replace requires oldText.')
        continue
      }
      const count = content.split(oldText).length - 1
      if (count === 0) {
        warnings.push(`oldText not found: ${clip(oldText, 80)}`)
        continue
      }
      if (count > 1 && op.all !== true) {
        warnings.push(
          `oldText matched ${count} times. Pass all:true or a unique snippet. Snippet: ${clip(oldText, 80)}`
        )
        continue
      }
      content = op.all === true ? content.split(oldText).join(newText) : content.replace(oldText, newText)
      continue
    }
    warnings.push(`Unknown source op "${kind}". Use replace, append, or replace-document.`)
  }
  const applied = content !== source
  if (!warnings.length) return { content, applied }
  return { content, applied, error: warnings.join('; ') }
}
