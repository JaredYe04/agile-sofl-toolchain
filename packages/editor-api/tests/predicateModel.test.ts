import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  parsePredicateFragment,
  predicateToUi,
  printPredicateText,
  uiToPredicateText,
  parsePredicateUi
} from '../src/predicateModel.js'

const grammarRoot = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures/grammar/predicates')

describe('predicateModel', () => {
  it('round-trips quantifier predicates', () => {
    const source = readFileSync(join(grammarRoot, 'quantifiers.asfl'), 'utf8')
    const invLine = source.match(/inv\s+([^;]+);/)?.[1]?.trim()
    expect(invLine).toBeTruthy()
    const { predicate, error } = parsePredicateFragment(invLine!)
    expect(error).toBeNull()
    expect(predicate).not.toBeNull()
    const printed = printPredicateText(predicate!)
    const again = parsePredicateFragment(printed)
    expect(again.error).toBeNull()
    const ui = predicateToUi(predicate!)
    expect(ui.kind).toBeTruthy()
    expect(uiToPredicateText(ui).length).toBeGreaterThan(0)
  })

  it('parses relational chains into UI', () => {
    const source = readFileSync(join(grammarRoot, 'relational-chain.asfl'), 'utf8')
    const invLine = source.match(/inv\s+([^;]+);/)?.[1]?.trim()
    const { predicate } = parsePredicateFragment(invLine!)
    expect(predicate).not.toBeNull()
    const { ui, error } = parsePredicateUi(invLine!)
    expect(error).toBeNull()
    expect(ui).not.toBeNull()
  })

  it('falls back to code node on invalid input', () => {
    const { ui } = parsePredicateUi('not a valid !!! predicate')
    expect(ui?.kind).toBe('code')
  })

  it('preserves binding types in quantifier UI round-trip', () => {
    const invLine = 'forall[i: set of nat] | i > 0'
    const { predicate, error } = parsePredicateFragment(invLine)
    expect(error).toBeNull()
    const ui = predicateToUi(predicate!)
    expect(ui.kind).toBe('quantified')
    if (ui.kind !== 'quantified') return
    expect(ui.bindings).toContain('set of nat')
    expect(ui.bindings).not.toMatch(/: nat\b/)
    const printed = uiToPredicateText(ui)
    expect(printed).toContain('set of nat')
    const again = parsePredicateFragment(printed)
    expect(again.error).toBeNull()
  })

  it('normalizes forevery/forsome to forall/exists in print', () => {
    const source = readFileSync(join(grammarRoot, 'forevery-forsome.asfl'), 'utf8')
    const invLines = source.match(/inv\s+([\s\S]+?);/)?.[1]?.trim()
    expect(invLines).toBeTruthy()
    const { predicate, error } = parsePredicateFragment(invLines!)
    expect(error).toBeNull()
    const ui = predicateToUi(predicate!)
    const printed = uiToPredicateText(ui)
    expect(printed).toMatch(/forall|exists/)
    expect(printed).not.toMatch(/forevery|forsome/)
  })

  it('round-trips nested quantifiers', () => {
    const invLine = 'forall[x: nat] exists[y: nat] | x = y'
    const { predicate, error } = parsePredicateFragment(invLine)
    expect(error).toBeNull()
    const ui = predicateToUi(predicate!)
    expect(ui.kind).toBe('quantified')
    if (ui.kind !== 'quantified') return
    expect(ui.nested.length).toBe(1)
    expect(ui.nested[0]).toContain('exists')
    expect(ui.nested[0]).toContain('nat')
    const printed = uiToPredicateText(ui)
    const again = parsePredicateFragment(printed)
    expect(again.error).toBeNull()
    expect(printPredicateText(again.predicate!)).toContain('exists')
  })

  it('preserves relational left/op/right in UI', () => {
    const invLine = 'x > 0'
    const { ui } = parsePredicateUi(invLine)
    expect(ui?.kind).toBe('relational')
    if (ui?.kind !== 'relational') return
    expect(ui.left).toBe('x')
    expect(ui.op).toBe('>')
    expect(ui.right).toBe('0')
  })
})
