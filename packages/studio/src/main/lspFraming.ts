/**
 * LSP Content-Length framing utilities.
 */
export function parseMessages(buffer: string): { messages: string[]; rest: string } {
  const messages: string[] = []
  let rest = buffer

  while (true) {
    const headerEnd = rest.indexOf('\r\n\r\n')
    if (headerEnd === -1) break

    const header = rest.slice(0, headerEnd)
    const match = /Content-Length:\s*(\d+)/i.exec(header)
    if (!match) {
      rest = rest.slice(headerEnd + 4)
      continue
    }

    const length = Number.parseInt(match[1], 10)
    const bodyStart = headerEnd + 4
    if (rest.length < bodyStart + length) break

    messages.push(rest.slice(bodyStart, bodyStart + length))
    rest = rest.slice(bodyStart + length)
  }

  return { messages, rest }
}

export function frameMessage(jsonBody: string): string {
  return `Content-Length: ${Buffer.byteLength(jsonBody, 'utf8')}\r\n\r\n${jsonBody}`
}
