const EXPECTING_PREFIX = /Expecting one of these/i

/** Shorten parser "Expecting token…" messages for compact UI. */
export function truncateDiagnostic(message: string, maxLen = 120): string {
  const trimmed = message.trim()
  if (trimmed.length <= maxLen) return trimmed
  if (EXPECTING_PREFIX.test(trimmed)) {
    const short = trimmed.replace(/\s+/g, ' ').slice(0, maxLen - 1)
    return `${short}…`
  }
  return `${trimmed.slice(0, maxLen - 1)}…`
}
