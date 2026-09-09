export type ClarificationDraftSource = {
  options?: Array<{ id: string; label: string }>
  multiSelect?: boolean
  answer?: string
}

export type ClarificationDraft = {
  ids: string[]
  custom: string
}

function answerParts(answer?: string): string[] {
  return (answer ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function toggleClarificationDraft(
  source: ClarificationDraftSource,
  optionId: string
): ClarificationDraft {
  const options = source.options ?? []
  const parts = answerParts(source.answer)
  const labels = new Set(options.map((o) => o.label))
  const ids = options.filter((o) => parts.includes(o.label)).map((o) => o.id)
  const custom = parts.filter((part) => !labels.has(part)).join('; ')
  const nextIds = source.multiSelect
    ? ids.includes(optionId)
      ? ids.filter((id) => id !== optionId)
      : [...ids, optionId]
    : ids.includes(optionId)
      ? []
      : [optionId]
  return { ids: nextIds, custom }
}
