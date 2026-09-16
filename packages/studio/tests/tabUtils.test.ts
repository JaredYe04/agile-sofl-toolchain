import { describe, it, expect } from 'vitest'
import {
  createDocumentTab,
  inferDocumentKind,
  defaultContentForKind,
  fileBelongsToRoot
} from '../src/renderer/stores/tabUtils'

describe('tabUtils documentKind', () => {
  it('defaults to asfl', () => {
    const tab = createDocumentTab()
    expect(tab.documentKind).toBe('asfl')
    expect(tab.content).toContain('module SYSTEM_New')
  })

  it('creates aspec tab', () => {
    const tab = createDocumentTab({ documentKind: 'aspec' })
    expect(tab.documentKind).toBe('aspec')
    expect(tab.content).toContain('# Functions')
    expect(tab.content).not.toContain('moduleId:')
  })

  it('infers kind from path', () => {
    expect(inferDocumentKind('C:/x/spec.aspec')).toBe('aspec')
    expect(inferDocumentKind('C:/x/spec.asfl')).toBe('asfl')
  })

  it('creates guispec tab', () => {
    const tab = createDocumentTab({ documentKind: 'guispec' })
    expect(tab.documentKind).toBe('guispec')
    expect(tab.content).toContain('as-app')
    expect(tab.content).toContain('data-screen')
  })

  it('infers guispec from path', () => {
    expect(inferDocumentKind('C:/x/ui.guispec')).toBe('guispec')
    expect(inferDocumentKind('C:/x/ui.gui.html')).toBe('guispec')
    expect(inferDocumentKind('C:/x/gui.html')).toBe('guispec')
  })

  it('treats files as inside a project root without matching sibling prefixes', () => {
    expect(fileBelongsToRoot('D:\\asfl\\test\\hybrid.asfl', 'D:\\asfl\\test')).toBe(true)
    expect(fileBelongsToRoot('D:\\asfl\\test2\\hybrid.asfl', 'D:\\asfl\\test')).toBe(false)
    expect(fileBelongsToRoot('D:\\asfl\\模拟外卖系统\\模拟外卖系统\\hybrid.asfl', 'D:\\asfl\\test')).toBe(
      false
    )
    expect(fileBelongsToRoot('D:\\asfl\\test', 'D:\\asfl\\test')).toBe(true)
  })
})
