import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, parseStrict, parseSpecification } from '../../src/index'

const parserRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const repoRoot = join(parserRoot, '..', '..')

function collectAsflFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...collectAsflFiles(full))
    else if (entry.endsWith('.asfl')) out.push(full)
  }
  return out
}

const corpusRoots = [
  join(parserRoot, 'tests', 'fixtures'),
  join(repoRoot, 'examples')
]

const corpus = corpusRoots.flatMap(collectAsflFiles)

const snippetSeeds = [
  'module SYSTEM_S; end_module',
  'module SYSTEM_S; var x: nat; end_module',
  'module SYSTEM_S; const a = 1; end_module',
  'module SYSTEM_S; process P () FSF : others && x = 1 end_process end_module',
  'module SYSTEM_S; function f () -> nat FSF : others && true end_function end_module',
  'module M / P; end_module',
  '/* comment */ module SYSTEM_C; end_module',
  'module SYSTEM_E; const v = {k -> k * 2 | k: nat & k < 5}; end_module'
]

function mutate(source: string, seed: number): string {
  const ops = [
    () => source + '\n',
    () => source.slice(0, Math.max(0, source.length - (seed % 7))),
    () => source.replace(/end_module/g, 'end_module\n'),
    () => source + ' '.repeat(seed % 5),
    () => `/* fuzz ${seed} */\n` + source
  ]
  return ops[seed % ops.length]()
}

describe('fuzz parse smoke', () => {
  it('parses every fixture and example without throwing', () => {
    expect(corpus.length).toBeGreaterThan(40)
    for (const file of corpus) {
      const source = readFileSync(file, 'utf-8')
      expect(() => parse(source)).not.toThrow()
      expect(() => parseStrict(source)).not.toThrow()
      expect(() => parseSpecification(source)).not.toThrow()
    }
  })

  it('tolerant parse returns diagnostics array for corrupted snippets', () => {
    for (let i = 0; i < snippetSeeds.length; i++) {
      const mutated = mutate(snippetSeeds[i], i + 1)
      const { diagnostics } = parse(mutated)
      expect(Array.isArray(diagnostics)).toBe(true)
    }
  })

  it('strict parse never throws on random prefix truncation', () => {
    const base = readFileSync(join(repoRoot, 'examples', 'ecommerce.asfl'), 'utf-8')
    for (let i = 0; i < 20; i++) {
      const len = Math.floor((base.length * (i + 1)) / 20)
      expect(() => parseStrict(base.slice(0, len))).not.toThrow()
    }
  })
})
