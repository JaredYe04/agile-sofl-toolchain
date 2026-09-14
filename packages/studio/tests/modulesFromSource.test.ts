import { describe, expect, it } from 'vitest'
import {
  modulesFromSource,
  overlayModulesForFile
} from '../src/shared/modulesFromSource'
import { actionsForSelection } from '../src/renderer/composables/visualActions'

describe('modulesFromSource', () => {
  it('collects modules from in-memory source even when the file is unsaved', () => {
    const source = `module SYSTEM_Root;
end_module;
module GUI_App / Root;
end_module.`
    const mods = modulesFromSource(source, 'C:\\proj\\hybrid.asfl')
    expect(mods.map((m) => m.name)).toEqual(['Root', 'GUI_App'])
    expect(mods[1]?.isGui).toBe(true)
  })

  it('exposes nested type/process/inv members and skips blank module names', () => {
    const source = `module SYSTEM_Root;
type
    Account = nat;
inv
    true;
process Login (x: nat) ok: nat
    pre
        true
    post
        ok = 1
end_process
end_module.`
    const mods = modulesFromSource(source, 'C:\\proj\\hybrid.asfl')
    expect(mods.every((m) => m.name.trim().length > 0)).toBe(true)
    expect(mods[0]?.members?.map((m) => `${m.kind}:${m.name}`)).toEqual([
      'type:Account',
      'inv:true',
      'process:Login'
    ])
  })

  it('overlays scan.modules for the same file path ignoring slash style', () => {
    const existing = modulesFromSource(
      `module SYSTEM_Old;\nend_module`,
      'C:/proj/hybrid.asfl'
    )
    const next = modulesFromSource(
      `system SYSTEM_New;\ntype T = nat;\nend_module;\nmodule GUI_Win / New;\nend_module`,
      'C:\\proj\\hybrid.asfl'
    )
    const merged = overlayModulesForFile(existing, 'C:\\proj\\hybrid.asfl', next)
    expect(merged.map((m) => m.name)).toEqual(['New', 'GUI_Win'])
  })

  it('keeps previous modules when a parse of the same file comes back empty', () => {
    const existing = modulesFromSource(
      `module SYSTEM_Keep;\nend_module`,
      'C:/proj/hybrid.asfl'
    )
    const merged = overlayModulesForFile(existing, 'C:\\proj\\hybrid.asfl', [], {
      keepPreviousIfEmpty: true
    })
    expect(merged.map((m) => m.name)).toEqual(['Keep'])
  })
})

describe('visual write actions', () => {
  it('keeps module write actions when diagnostics exist but parse did not fail', () => {
    const actions = actionsForSelection(
      { kind: 'module', moduleName: 'Root' },
      { parseFailed: false, hasDiagnostics: true }
    )
    expect(actions).toContain('addProcess')
    expect(actions).toContain('renameModule')
  })

  it('pauses write actions only when parseFailed', () => {
    const actions = actionsForSelection(
      { kind: 'module', moduleName: 'Root' },
      { parseFailed: true, hasDiagnostics: false }
    )
    expect(actions).toEqual(['revealInCode'])
  })
})
