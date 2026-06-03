import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, parse, printProgram, normalizeAST, astEqual } from '../../src/index'
import { isProgramNode } from '../../src/ast/guards'

const parserRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const monorepoRoot = join(parserRoot, '..', '..')

function loadExample(name: string): string {
  return readFileSync(join(monorepoRoot, 'examples', `${name}.asfl`), 'utf-8')
}

function leadingSpaces(line: string): number {
  const m = line.match(/^ */)
  return m ? m[0].length : 0
}

describe('Pretty-printer indentation', () => {
  it('formats ecommerce with 4-space semantic layout', () => {
    const { source: out } = format(loadExample('ecommerce'))
    const lines = out.split('\n')

    const processLine = lines.find((l) => l.startsWith('process AddToCart'))
    expect(processLine).toBeDefined()
    expect(leadingSpaces(processLine!)).toBe(0)

    const endProcess = lines.filter((l) => l.trim() === 'end_process')
    expect(endProcess.every((l) => leadingSpaces(l) === 0)).toBe(true)

    const extLine = lines.find((l) => l.trim() === 'ext')
    expect(extLine).toBeDefined()
    expect(leadingSpaces(extLine!)).toBe(4)

    const rdLine = lines.find((l) => l.startsWith('    rd inventory'))
    expect(rdLine).toBeDefined()
    expect(leadingSpaces(rdLine!)).toBe(4)

    const composedField = lines.find((l) => l.trim() === 'id: ProductId')
    expect(composedField).toBeDefined()
    expect(leadingSpaces(composedField!)).toBe(8)

    const fsfScenarios = lines.filter((l) => l.includes('&& ok =') || l.trim().startsWith('others &&'))
    expect(fsfScenarios.length).toBeGreaterThanOrEqual(3)
    expect(fsfScenarios.every((l) => leadingSpaces(l) === 4)).toBe(true)
  })

  it('formats composed types and const section items', () => {
    const source = `module SYSTEM_T;
const
n = 1;
type
Item = composed of
  x: nat
  y: nat
end;
var
z: nat;
end_module`
    const { source: out } = format(source)
    expect(out).toContain('    n = 1;')
    expect(out).toContain('    Item = composed of')
    expect(out).toContain('        x: nat')
    expect(out).toContain('    end;')
    expect(out).toContain('    z: nat;')
  })

  it('parse → print → parse preserves structure with indentation', () => {
    const source = loadExample('library-system')
    const { ast: ast1 } = parse(source)
    expect(ast1).not.toBeNull()
    if (!isProgramNode(ast1)) return

    const printed = printProgram(ast1)
    const { ast: ast2 } = parse(printed)
    expect(ast2).not.toBeNull()
    if (!isProgramNode(ast2)) return

    expect(astEqual(normalizeAST(ast1), normalizeAST(ast2))).toBe(true)
  })
})
