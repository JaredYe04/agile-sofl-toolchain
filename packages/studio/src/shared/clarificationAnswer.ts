export type ClarificationAnswer = {
  selected: string[]
  custom: string
  answer: string
}

/** Clicked option labels plus whatever the user typed. Custom text is never dropped. */
export function composeClarificationAnswer(input: {
  selectedLabels: string[]
  custom?: string
  multiSelect?: boolean
}): ClarificationAnswer {
  const labels = input.selectedLabels.map((label) => label.trim()).filter(Boolean)
  const selected = input.multiSelect ? labels : labels.slice(0, 1)
  const custom = (input.custom ?? '').trim()
  return {
    selected,
    custom,
    answer: [...selected, custom].filter(Boolean).join('; ')
  }
}

export function encodeClarificationAnswer(answer: ClarificationAnswer): string {
  return JSON.stringify({ selected: answer.selected, custom: answer.custom })
}

/** Keep an already composed answer and append more text the user typed elsewhere. */
export function mergeClarificationCustom(encoded: string, extra: string): string {
  const extraText = extra.trim()
  if (!extraText) return encoded
  try {
    const parsed = JSON.parse(encoded) as { selected?: unknown; custom?: unknown }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an answer')
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.filter((item): item is string => typeof item === 'string')
      : []
    const prior = typeof parsed.custom === 'string' ? parsed.custom.trim() : ''
    const custom = [prior, extraText].filter(Boolean).join('\n')
    return encodeClarificationAnswer(
      composeClarificationAnswer({ selectedLabels: selected, custom, multiSelect: true })
    )
  } catch {
    const custom = [encoded.trim(), extraText].filter(Boolean).join('\n')
    return encodeClarificationAnswer(composeClarificationAnswer({ selectedLabels: [], custom, multiSelect: true }))
  }
}

function readStructured(result: string): { selected: string[]; custom: string } | null {
  try {
    const parsed = JSON.parse(result) as { action?: unknown; selected?: unknown; custom?: unknown }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (typeof parsed.action === 'string') return null
    const hasSelected = Array.isArray(parsed.selected)
    const hasCustom = typeof parsed.custom === 'string'
    if (!hasSelected && !hasCustom) return null
    const selected = hasSelected
      ? parsed.selected.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : []
    const custom = hasCustom ? parsed.custom.trim() : ''
    return { selected, custom }
  } catch {
    return null
  }
}

export function formatClarificationToolContent(
  result: string,
  options?: { labels?: string[]; multiSelect?: boolean }
): { display: string; toolContent: string } {
  const structured = readStructured(result)
  let selected: string[]
  let custom: string
  if (structured) {
    selected = options?.multiSelect ? structured.selected : structured.selected.slice(0, 1)
    custom = structured.custom
  } else {
    const labels = new Set(options?.labels ?? [])
    const parts = result
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
    selected = parts.filter((part) => labels.has(part))
    const customParts = parts.filter((part) => !labels.has(part))
    if (!options?.multiSelect && selected.length > 1) selected = selected.slice(0, 1)
    custom = selected.length === 0 ? result.trim() : customParts.join('; ')
  }
  const answer = [...selected, custom].filter(Boolean).join('; ')
  const next = custom
    ? 'custom is text the user typed. You MUST use it even when this question was single-choice (multiSelect false) and even when selected is also non-empty. A clicked option does not replace or cancel custom. Then continue the task.'
    : 'Use the selected answer and continue the task. If more work remains, propose the next change or ask_clarification. When the task is done, write a short summary.'
  return {
    display: answer || result.trim(),
    toolContent: JSON.stringify({
      type: 'clarification_answer',
      selected,
      custom,
      answer: answer || result.trim(),
      next
    })
  }
}

/** Repeat a typed answer in the continuation nudge so the model cannot skip it. */
export function clarificationContinuationText(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as {
      type?: unknown
      custom?: unknown
      selected?: unknown
      answer?: unknown
    }
    if (!parsed || parsed.type !== 'clarification_answer') return null
    const custom = typeof parsed.custom === 'string' ? parsed.custom.trim() : ''
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('; ')
      : ''
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
    if (custom) {
      return `The user answered a clarification. Selected options: ${selected || '(none)'}. Custom answer, which you MUST follow even if the question was single-choice and even if a selected option is also present: ${custom}. Do not ignore this custom answer. Continue the task with propose_* or another ask_clarification as needed, then summarize when done.`
    }
    return `The user answered a clarification: ${answer || selected || '(empty)'}. Continue the task. Prefer propose_changes / propose_hybrid_changes. When the task is done, write a short summary and stop.`
  } catch {
    return null
  }
}
