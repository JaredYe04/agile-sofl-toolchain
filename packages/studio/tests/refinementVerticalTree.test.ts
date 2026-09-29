import { describe, expect, it } from 'vitest'

import {

  buildRefinementVerticalForest,

  buildVerticalTreeLayout,
  verticalNodesOverlap
} from '../src/renderer/lib/refinementVerticalTree'

import { emptyRefinementState, type RefinementProcessRow } from '../src/renderer/lib/refinementTypes'



function leaf(over: Partial<RefinementProcessRow> & Pick<RefinementProcessRow, 'moduleName' | 'processName'>): RefinementProcessRow {

  return {

    hasDecom: false,

    informalAtomCount: 0,

    typesDefined: true,

    scenarioCoverageComplete: true,

    onCdfd: true,

    isStub: false,

    structurallyAtomic: true,

    informalAtoms: [],

    declaredAtomic: true,

    status: 'atomic',

    effectPattern: 'opaque',

    grainClass: 'operation',

    nameEffectMismatch: false,

    variations: [],

    grainClosed: true,

    operationallyAtomic: true,

    ...over

  }

}



describe('refinement vertical tree', () => {

  it('roots at SYSTEM and nests decom child module under composite process', () => {

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

        structurallyAtomic: false,

        status: 'open'

      }),

      leaf({ moduleName: 'Banking_Decom', processName: 'Withdraw' })

    ]

    const forest = buildRefinementVerticalForest(state)

    expect(forest).toHaveLength(1)

    expect(forest[0]!.label).toBe('SYSTEM_Banking')

    const composite = forest[0]!.children.find((c) => c.kind === 'composite')

    expect(composite?.label).toBe('A')

    expect(composite?.children[0]?.kind).toBe('module')

    expect(composite?.children[0]?.children[0]?.status).toBe('atomic')

  })



  it('hangs ordinary modules under an empty SYSTEM module', () => {
    const state = emptyRefinementState()
    state.modules = [
      { name: 'Library', isSystem: true, isEmpty: true },
      { name: 'Catalog', isSystem: false, isEmpty: false },
      { name: 'Loans', isSystem: false, isEmpty: false }
    ]
    state.processes = [
      leaf({ moduleName: 'Catalog', processName: 'Search' }),
      leaf({ moduleName: 'Loans', processName: 'Borrow', status: 'open', structurallyAtomic: false })
    ]
    const forest = buildRefinementVerticalForest(state)
    expect(forest).toHaveLength(1)
    expect(forest[0]!.label).toBe('SYSTEM_Library')
    expect(forest[0]!.children.map((child) => child.label).sort()).toEqual(['Catalog', 'Loans'])
    expect(forest[0]!.children.every((child) => child.kind === 'module')).toBe(true)
    expect(forest[0]!.children.some((child) => child.kind === 'gap')).toBe(false)
  })

  it('layout produces nodes and edges', () => {

    const state = emptyRefinementState()

    state.modules = [{ name: 'S', isSystem: true, isEmpty: false }]

    state.processes = [leaf({ moduleName: 'S', processName: 'P' })]

    const layout = buildVerticalTreeLayout(state)

    expect(layout.nodes.length).toBeGreaterThanOrEqual(2)

    expect(layout.edges.length).toBeGreaterThanOrEqual(1)

    expect(layout.width).toBeGreaterThan(0)

  })

  it('does not overlap siblings or stacked roots', () => {
    const state = emptyRefinementState()
    state.modules = [
      { name: 'S', isSystem: true, isEmpty: false },
      { name: 'Other', isSystem: true, isEmpty: false },
      { name: 'Child', isSystem: false, parentName: 'S', isEmpty: false }
    ]
    state.processes = [
      leaf({
        moduleName: 'S',
        processName: 'Wide',
        hasDecom: true,
        decomTarget: 'Child',
        structurallyAtomic: false,
        status: 'open'
      }),
      leaf({ moduleName: 'S', processName: 'Sibling' }),
      leaf({ moduleName: 'Child', processName: 'A' }),
      leaf({ moduleName: 'Child', processName: 'B' }),
      leaf({ moduleName: 'Child', processName: 'C' }),
      leaf({ moduleName: 'Other', processName: 'Q' })
    ]
    const layout = buildVerticalTreeLayout(state)
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        expect(verticalNodesOverlap(layout.nodes[i]!, layout.nodes[j]!)).toBe(false)
      }
    }
  })

})


