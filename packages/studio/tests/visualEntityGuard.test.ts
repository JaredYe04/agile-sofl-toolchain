import { describe, expect, it } from 'vitest'
import { isDuplicateInModule } from '../src/renderer/lib/visualEntityGuard'
import type { VisualModuleSummary } from '../src/preload/index'

const baseModule = (): VisualModuleSummary =>
  ({
    name: 'M',
    isSystem: false,
    span: { start: 0, end: 1, line: 1, column: 1 },
    constCount: 0,
    typeCount: 0,
    varCount: 0,
    invCount: 2,
    invariants: [
      { text: '1 <= 1', span: { start: 0, end: 6, line: 1, column: 1 } },
      { text: '2 <= 2', span: { start: 7, end: 13, line: 2, column: 1 } }
    ],
    processes: [],
    functions: [],
    consts: [],
    types: [],
    vars: []
  }) as VisualModuleSummary

describe('visualEntityGuard', () => {
  it('detects duplicate invariant text', () => {
    const mod = baseModule()
    expect(isDuplicateInModule(mod, 'invariant', '1 <= 1')).toBe(true)
    expect(isDuplicateInModule(mod, 'invariant', '1 <= 1', { excludeInvariantIndex: 0 })).toBe(false)
  })
})
