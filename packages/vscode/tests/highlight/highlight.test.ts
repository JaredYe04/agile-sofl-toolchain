import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  highlightSource,
  annotateLine,
  assertIdentifierNotSplit
} from '../../scripts/highlight-lib.mjs'

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const highlightFixtures = join(monorepoRoot, 'packages', 'parser', 'tests', 'fixtures', 'highlight')

function loadExample(name: string): string {
  return readFileSync(join(monorepoRoot, 'examples', `${name}.asfl`), 'utf-8')
}

function loadHighlightFixture(name: string): {
  line: string
  segments: Array<{ text: string; colorClass: string }>
} {
  const fixture = JSON.parse(
    readFileSync(join(highlightFixtures, `${name}.highlight.json`), 'utf-8')
  ) as {
    line?: string
    lineNumber?: number
    source?: string
    segments: Array<{ text: string; colorClass: string }>
  }
  if (fixture.line) {
    return { line: fixture.line, segments: fixture.segments }
  }
  const sourceFile = fixture.source ?? `${name}.asfl`
  const sourcePath = join(highlightFixtures, sourceFile)
  const sourceLines = readFileSync(sourcePath, 'utf-8').split(/\r?\n/)
  const lineNo = fixture.lineNumber ?? 1
  const line = sourceLines[lineNo - 1] ?? ''
  return { line, segments: fixture.segments }
}

function expectHighlightFile(name: string) {
  const { line, segments } = loadHighlightFixture(name)
  return highlightSource(line).then((highlighted) => {
    const segs = segmentsForLine(highlighted, line)
    expectSegmentTexts(segs, segments)
  })
}

const highlightSnapshotNames = readdirSync(highlightFixtures)
  .filter((f) => f.endsWith('.highlight.json'))
  .map((f) => f.replace('.highlight.json', ''))

function segmentsForLine(highlighted: Awaited<ReturnType<typeof highlightSource>>, lineText: string) {
  const row = highlighted.find((r) => r.text === lineText)
  expect(row).toBeDefined()
  return row!.segments
}

function expectSegmentTexts(
  segments: Array<{ text: string; colorClass: string }>,
  expected: Array<{ text: string; colorClass: string }>
) {
  const meaningful = segments.filter((s) => s.text.trim().length > 0)
  for (const exp of expected) {
    const match = meaningful.find((s) => s.text === exp.text)
    expect(match, `missing segment "${exp.text}" in ${meaningful.map((s) => s.text).join('|')}`).toBeDefined()
    expect(match!.colorClass).toBe(exp.colorClass)
  }
}

describe('TextMate highlight', () => {
  it('does not split total inside identifiers', async () => {
    const highlighted = await highlightSource('var total: nat;')
    assertIdentifierNotSplit(highlighted, 'total', ['entityType', 'param', 'identifier'])
    const segs = segmentsForLine(highlighted, 'var total: nat;')
    expect(segs.some((s) => s.text === 'total' && s.text !== 'to')).toBe(true)
    expect(segs.filter((s) => s.text === 'to')).toHaveLength(0)
  })

  it('does not split subtotal', async () => {
    const highlighted = await highlightSource('wr subtotal: nat')
    assertIdentifierNotSplit(highlighted, 'subtotal', ['param', 'identifier'])
  })

  it('colors comment informal line with marker and body', async () => {
    const line = 'comment: informal add product when customer is active'
    const highlighted = await highlightSource(line)
    const segs = segmentsForLine(highlighted, line)
    expectSegmentTexts(segs, [
      { text: 'comment', colorClass: 'kwDecl' },
      { text: 'informal', colorClass: 'informalMarker' }
    ])
    expect(segs.some((s) => s.text === 'add' && s.colorClass === 'informalText')).toBe(true)
  })

  it('highlights map type to as operator not inside identifiers', async () => {
    const line = 'type M = map string to nat;'
    const highlighted = await highlightSource(line)
    const segs = segmentsForLine(highlighted, line)
    expect(segs.some((s) => s.text === 'to' && ['operator', 'kwDecl'].includes(s.colorClass))).toBe(true)
    assertIdentifierNotSplit(highlighted, 'string', ['type', 'identifier'])
  })

  it('highlights keyword-traps example identifiers', async () => {
    const source = loadExample('keyword-traps')
    const highlighted = await highlightSource(source)
    for (const id of ['total', 'subtotal', 'informal_flag', 'different', 'mycomment']) {
      assertIdentifierNotSplit(highlighted, id, ['entityType', 'param', 'identifier'])
    }
  })

  it('module line uses distinct colors for module, SYSTEM_, and name', async () => {
    const line = 'module SYSTEM_Traps;'
    const segs = segmentsForLine(await highlightSource(line), line)
    expectSegmentTexts(segs, [
      { text: 'module', colorClass: 'kwCtrl' },
      { text: 'SYSTEM_', colorClass: 'systemPrefix' },
      { text: 'Traps', colorClass: 'module' }
    ])
  })

  it('annotates line with colorClass tags', async () => {
    const highlighted = await highlightSource('module SYSTEM_Demo;')
    const row = highlighted[0]
    const annotated = annotateLine(row.segments)
    expect(annotated).toContain('{kwCtrl}module{/kwCtrl}')
    expect(annotated).toContain('{module}Demo{/module}')
  })

  for (const name of highlightSnapshotNames) {
    it(`matches ${name} highlight snapshot`, () => expectHighlightFile(name))
  }
})
