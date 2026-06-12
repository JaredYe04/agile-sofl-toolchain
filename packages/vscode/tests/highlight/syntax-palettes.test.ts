import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts')
const palettes = JSON.parse(readFileSync(join(scriptsDir, 'syntax-palettes.json'), 'utf8')) as {
  light: { rules: Array<{ token: string; foreground: string }> }
  dark: { rules: Array<{ token: string; foreground: string }> }
}

function ruleFg(rules: Array<{ token: string; foreground: string }>, token: string): string {
  return rules.find((r) => r.token === token)?.foreground ?? ''
}

describe('syntax-palettes', () => {
  it('light theme uses darker operator colors than dark theme', () => {
    const lightOp = ruleFg(palettes.light.rules, 'keyword.operator.logical.asfl')
    const darkOp = ruleFg(palettes.dark.rules, 'keyword.operator.logical.asfl')
    expect(lightOp).toBe('333333')
    expect(darkOp).toBe('D4D4D4')
    expect(lightOp).not.toBe(darkOp)
  })

  it('light identifiers are not pale blue-gray', () => {
    const lightId = ruleFg(palettes.light.rules, 'variable.other.asfl')
    expect(lightId).toBe('001080')
    expect(lightId).not.toBe('9CDCFE')
  })
})
