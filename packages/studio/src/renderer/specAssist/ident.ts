export function toAsflIdent(phrase: string): string {
  const cleaned = phrase
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const ascii = cleaned.replace(/[^\w]/g, '_')
  const ident = ascii || 'P'
  return /^[A-Za-z_]/.test(ident) ? ident : `P_${ident}`
}

export function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function processStubTemplate(name: string, comment?: string): string {
  const note = comment?.trim() ? `comment\n  ${comment.trim()}\nend_comment\n` : ''
  return `process ${name} (x: nat) ok: nat
${note}FSF :
x > 0 && ok = 1 ||
others && ok = 0
end_process`
}
