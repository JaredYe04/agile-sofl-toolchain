import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { findHeadingIndex, spanForHybridSelection } from '../src/renderer/lib/structureNav'
import { useWorkspaceStore } from '../src/renderer/stores/workspace'

describe('structureNav', () => {
  it('matches headings by title rather than markdown line index', () => {
    const headings = [{ textContent: 'Functions' }, { textContent: 'Open account' }, { textContent: 'Constraints' }]
    expect(findHeadingIndex(headings, { title: 'Open account', line: 12 })).toBe(1)
    expect(findHeadingIndex(headings, { title: 'Functions' })).toBe(0)
    expect(findHeadingIndex(headings, { title: 'Missing', line: 3 })).toBe(2)
  })

  it('resolves hybrid process and module spans', () => {
    const model = {
      modules: [
        {
          name: 'ATM',
          span: { start: 0, end: 80, line: 1, column: 1 },
          processes: [{ name: 'Withdraw', span: { start: 20, end: 55, line: 4, column: 1 } }],
          functions: [{ name: 'fee', span: { start: 56, end: 70, line: 10, column: 1 } }]
        }
      ]
    }
    expect(spanForHybridSelection(model, { kind: 'module', moduleName: 'ATM' })).toEqual({
      start: 0,
      end: 80,
      line: 1,
      column: 1
    })
    expect(
      spanForHybridSelection(model, { kind: 'process', moduleName: 'ATM', processName: 'Withdraw' })
    ).toEqual({ start: 20, end: 55, line: 4, column: 1 })
    expect(
      spanForHybridSelection(model, { kind: 'function', moduleName: 'ATM', functionName: 'fee' })
    ).toEqual({ start: 56, end: 70, line: 10, column: 1 })
    expect(spanForHybridSelection(model, { kind: 'module', moduleName: 'Missing' })).toBeNull()
  })
})

describe('structure reveal requests', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('switches informal panel to document and bumps the reveal nonce', () => {
    const workspace = useWorkspaceStore()
    workspace.informalViewMode = 'graphical'
    workspace.revealInformalInDocument('fn-open-account')
    expect(workspace.informalViewMode).toBe('document')
    expect(workspace.informalSelectedNodeId).toBe('fn-open-account')
    expect(workspace.informalRevealNonce).toBe(1)
    workspace.revealInformalInDocument('fn-open-account')
    expect(workspace.informalRevealNonce).toBe(2)
  })

  it('switches hybrid panel to code and selects the target module', () => {
    const workspace = useWorkspaceStore()
    workspace.hybridMode = 'visual'
    workspace.revealHybridInCode('ATM', {
      kind: 'process',
      moduleName: 'ATM',
      processName: 'Withdraw'
    })
    expect(workspace.hybridMode).toBe('code')
    expect(workspace.selectedModuleName).toBe('ATM')
    expect(workspace.selection).toEqual({
      kind: 'process',
      moduleName: 'ATM',
      processName: 'Withdraw'
    })
    expect(workspace.hybridRevealNonce).toBe(1)
  })
})
