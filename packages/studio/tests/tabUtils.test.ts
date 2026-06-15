import { describe, it, expect } from 'vitest'
import { createDocumentTab, inferDocumentKind, defaultContentForKind } from '../src/renderer/stores/tabUtils'

describe('tabUtils documentKind', () => {
  it('defaults to asfl', () => {
    const tab = createDocumentTab()
    expect(tab.documentKind).toBe('asfl')
    expect(tab.content).toContain('module SYSTEM_New')
  })

  it('creates aspec tab', () => {
    const tab = createDocumentTab({ documentKind: 'aspec' })
    expect(tab.documentKind).toBe('aspec')
    expect(tab.content).toContain('aspecVersion')
  })

  it('infers kind from path', () => {
    expect(inferDocumentKind('C:/x/spec.aspec')).toBe('aspec')
    expect(inferDocumentKind('C:/x/spec.asfl')).toBe('asfl')
  })

  it('defaultContentForKind aspec has purpose', () => {
    expect(defaultContentForKind('aspec')).toContain('purpose')
  })
})
