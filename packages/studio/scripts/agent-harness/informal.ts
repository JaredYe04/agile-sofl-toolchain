import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/**
 * Read an informal .aspec input platform-independently: strip a UTF-8 BOM and normalise CRLF/CR to LF.
 * A Windows checkout with core.autocrlf=true has CRLF fixtures; without this the LLM prompt, the prompt
 * hash and the B0-auto output would differ from a Linux/macOS checkout of the same commit.
 */
export function readInformal(path: string): { text: string; sha256: string } {
  const text = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  return { text, sha256: createHash('sha256').update(text).digest('hex') }
}
