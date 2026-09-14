export type MissingCase = {
  id: string
  summary: string
}

export function findMissingCases(input: {
  name: string
  pre?: string
  post?: string
  comment?: string
  scenarioCount?: number
}): MissingCase[] {
  const blob = `${input.name} ${input.pre ?? ''} ${input.post ?? ''} ${input.comment ?? ''}`.toLowerCase()
  const missing: MissingCase[] = []
  if (input.pre?.trim() && !/precondition violat|not \(/.test(blob)) {
    missing.push({ id: 'pre-violated', summary: 'Precondition violated (exceptional scenario)' })
  }
  if (/\b(amount|quantity|count)\b/.test(blob) && !/zero|positive|greater than 0|amount > 0/.test(blob)) {
    missing.push({ id: 'zero-amount', summary: 'Amount is zero or not positive' })
  }
  if (/\b(account|user|member|customer)\b/.test(blob) && !/exist|unknown|not found|invalid/.test(blob)) {
    missing.push({ id: 'unknown-entity', summary: 'Account or user does not exist' })
  }
  if (/\b(limit|frozen|lock|daily)\b/.test(blob) === false && /\bwithdraw|transfer|pay\b/.test(blob)) {
    missing.push({ id: 'limit', summary: 'Amount exceeds a daily or account limit' })
    missing.push({ id: 'frozen', summary: 'Account is frozen or locked' })
  }
  if ((input.scenarioCount ?? 0) < 2 && /\bif\b|\bthen\b/.test(blob) === false) {
    missing.push({ id: 'alt-path', summary: 'No alternative (else) behaviour is specified' })
  }
  return missing
}
