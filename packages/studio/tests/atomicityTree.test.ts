import { describe, expect, it } from 'vitest'
import { buildAtomicityRows, dualLineProgress, initialExpandedIds, leafStats } from '../src/renderer/lib/atomicityTree'
import { buildRefineAgentBootstrap, refineToolsForRow } from '../src/renderer/lib/refineAgentTools'
import { emptyRefinementState, type RefinementProcessRow } from '../src/renderer/lib/refinementTypes'

function leaf(over: Partial<RefinementProcessRow> & Pick<RefinementProcessRow, 'moduleName' | 'processName'>): RefinementProcessRow {
  return {
    hasDecom: false,
    informalAtomCount: 0,
    typesDefined: true,
    scenarioCoverageComplete: true,
    onCdfd: true,
    isStub: false,
    structurallyAtomic: false,
    informalAtoms: [],
    declaredAtomic: false,
    status: 'open',
    effectPattern: 'opaque',
    grainClass: 'unclassified',
    nameEffectMismatch: false,
    variations: [],
    grainClosed: false,
    operationallyAtomic: false,
    ...over
  }
}

describe('atomicity tree rows', () => {
  it('nests decom child modules under the composite process and keeps them off the root', () => {
    const state = emptyRefinementState()
    state.modules = [
      { name: 'Banking', isSystem: true, isEmpty: false },
      { name: 'Banking_Decom', isSystem: false, parentName: 'Banking', isEmpty: false }
    ]
    state.processes = [
      leaf({
        moduleName: 'Banking',
        processName: 'A',
        hasDecom: true,
        decomTarget: 'Banking_Decom',
        typesDefined: true,
        scenarioCoverageComplete: false,
        onCdfd: false,
        structurallyAtomic: false,
        status: 'open'
      }),
      leaf({
        moduleName: 'Banking_Decom',
        processName: 'Withdraw',
        informalAtomCount: 1,
        informalAtoms: [
          {
            key: 'k',
            moduleName: 'Banking_Decom',
            processName: 'Withdraw',
            clause: 'pre',
            text: 'amount is positive'
          }
        ],
        typesDefined: true,
        scenarioCoverageComplete: false,
        onCdfd: true,
        structurallyAtomic: false,
        status: 'open'
      })
    ]
    state.processAmbiguity = 3
    const expanded = new Set(initialExpandedIds(state))
    expanded.add('mod:Banking')
    expanded.add('proc:Banking:A')
    expanded.add('mod:Banking_Decom')
    expanded.add('proc:Banking_Decom:Withdraw')
    expanded.add('proc:Banking_Decom:Withdraw:gate:informal')
    const rows = buildAtomicityRows(state, expanded)
    const moduleLabels = rows.filter((r) => r.kind === 'module').map((r) => r.label)
    expect(moduleLabels.filter((n) => n === 'SYSTEM_Banking' || n === 'Banking').length).toBe(1)
    expect(moduleLabels.filter((n) => n === 'Banking_Decom').length).toBe(1)
    const composite = rows.find((r) => r.kind === 'composite' && r.processName === 'A')
    const child = rows.find((r) => r.kind === 'module' && r.moduleName === 'Banking_Decom')
    expect(composite).toBeTruthy()
    expect(child).toBeTruthy()
    expect(child!.depth).toBeGreaterThan(composite!.depth)
    expect(rows.some((r) => r.kind === 'leaf' && r.processName === 'Withdraw')).toBe(true)
    expect(rows.some((r) => r.kind === 'atom' && r.label === 'amount is positive')).toBe(true)
    expect(leafStats(state, 'Banking')).toEqual({ atomic: 0, total: 1 })
    expect(initialExpandedIds(state)).toEqual(['process-root', 'data-root'])
  })

  it('treats a name-only module as one incomplete expected leaf', () => {
    const state = emptyRefinementState()
    state.modules = [{ name: '成绩录入与统计', isSystem: false, isEmpty: true }]
    state.breakdown.emptyModuleCount = 1
    state.processAmbiguity = 1
    expect(leafStats(state, '成绩录入与统计')).toEqual({ atomic: 0, total: 1 })
    const expanded = new Set(initialExpandedIds(state))
    const rows = buildAtomicityRows(state, expanded)
    expect(rows.some((r) => r.kind === 'gap' && r.isEmpty)).toBe(true)
    const mod = rows.find((r) => r.kind === 'module')
    expect(mod?.problem).toBe(true)
    expect(refineToolsForRow(mod!).includes('fill-empty-module')).toBe(true)
    const progress = dualLineProgress(state)
    expect(progress.processRate).toBe(0)
    expect(progress.dataRate).toBe(0)
    expect(progress.overall).toBe(0)
    expect(progress.expectedLeaves).toBe(1)
  })

  it('launches hybrid-refinement with a preset prompt for a stub process', () => {
    const treeRow = {
      id: 'proc:S:P',
      depth: 1,
      kind: 'leaf' as const,
      label: 'P',
      moduleName: 'S',
      processName: 'P',
      problem: true,
      isStub: true,
      status: 'open' as const
    }
    expect(refineToolsForRow(treeRow)).toContain('fill-stub-process')
    const boot = buildRefineAgentBootstrap('fill-stub-process', treeRow, 'zh-CN')
    expect(boot.skillId).toBe('hybrid-refinement')
    expect(boot.initialUserMessage).toContain('P')
    expect(boot.permissions.hybrid.write).toBe(true)
  })
})
