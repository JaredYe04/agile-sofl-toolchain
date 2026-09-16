import { describe, expect, it } from 'vitest'
import { parse } from '@agile-sofl/parser'
import {
  addModule,
  applyHybridPatch,
  formatHybridInventory,
  removeModule,
  setModuleParent
} from '../src/index.js'
import { hybridLeftoverMessage, insertInvLine } from '../src/moduleSourceRange.js'

const SESSION_ORPHANS = `module SYSTEM_______;
end_module;
module GUI_App / ______;
end_module.`

describe('hybrid CRUD harness regression', () => {
  it('removes a SYSTEM_ module without leaving / parent junk', () => {
    const next = removeModule(SESSION_ORPHANS, 'SYSTEM_______')
    expect(next).not.toMatch(/SYSTEM_______/)
    expect(next).not.toMatch(/\/\s*______/)
    expect(next).toContain('module GUI_App')
    expect(hybridLeftoverMessage(next)).toBeNull()
    const { ast, diagnostics } = parse(next)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.map((m) => m.name)).toEqual(['GUI_App'])
    }
    const inventory = formatHybridInventory(next)
    expect(inventory).toContain('mod:GUI_App')
    expect(inventory).not.toMatch(/empty hybrid/i)
  })

  it('CRUD remove of SYSTEM_______ then GUI_App does not report success on leftover junk', () => {
    const first = applyHybridPatch(SESSION_ORPHANS, {
      operations: [{ op: 'remove', id: 'mod:SYSTEM_______' }]
    })
    expect(first.error).toBeUndefined()
    expect(first.content).toContain('module GUI_App')
    expect(first.content).not.toMatch(/\/\s*______/)

    const second = applyHybridPatch(first.content, {
      operations: [{ op: 'remove', id: 'mod:GUI_App' }]
    })
    expect(second.content.trim() === '' || !second.content.includes('end_module')).toBe(true)
    expect(hybridLeftoverMessage(second.content)).toBeNull()
    expect(formatHybridInventory(second.content)).toMatch(/empty hybrid/i)
  })

  it('does not call leftover-free inventory empty when a headerless remnant remains', () => {
    const remnant = ' / ______;\nend_module.'
    expect(hybridLeftoverMessage(remnant)).toMatch(/leftover/)
    expect(formatHybridInventory(remnant)).toMatch(/leftover/)
    expect(formatHybridInventory(remnant)).not.toBe('(empty hybrid specification)')
  })

  it('prepends SYSTEM_ as the first module', () => {
    const source = `module GUI_App;
end_module.`
    const next = addModule(source, 'SYSTEM_FoodDelivery', { isSystem: true })
    expect(next.indexOf('module SYSTEM_FoodDelivery')).toBe(0)
    expect(next.indexOf('module SYSTEM_FoodDelivery')).toBeLessThan(next.indexOf('module GUI_App'))
    const { ast } = parse(next.replace(/\.$/, ''))
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules[0]?.name).toBe('FoodDelivery')
      expect(ast.modules[0]?.isSystem).toBe(true)
    }
  })

  it('CRUD add SYSTEM_ then child module with parent, default process (), inv after var', () => {
    const step1 = applyHybridPatch('', {
      operations: [{ op: 'add', kind: 'module', name: 'SYSTEM_FoodDelivery' }]
    })
    expect(step1.error).toBeUndefined()
    expect(step1.content.trimStart().startsWith('module SYSTEM_FoodDelivery')).toBe(true)

    const step2 = applyHybridPatch(step1.content, {
      operations: [
        { op: 'add', kind: 'module', name: 'Auth', parentId: 'mod:SYSTEM_FoodDelivery' },
        { op: 'add', kind: 'var', parentId: 'mod:Auth', name: 'session', text: 'session: nat' },
        { op: 'add', kind: 'inv', parentId: 'mod:Auth', name: 'logged', text: 'session > 0 implies session < 1000' },
        { op: 'add', kind: 'process', parentId: 'mod:Auth', name: 'Login', pre: 'true', post: 'true' }
      ]
    })
    expect(step2.error).toBeUndefined()
    expect(step2.content).toContain('module Auth / FoodDelivery;')
    expect(step2.content).toContain('process Login ()')
    expect(step2.content).not.toContain('(x: nat) ok: nat')
    const varAt = step2.content.indexOf('session: nat')
    const invAt = step2.content.indexOf('inv')
    expect(varAt).toBeGreaterThan(-1)
    expect(invAt).toBeGreaterThan(varAt)
    const { ast, diagnostics } = parse(step2.content)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules[0]?.name).toBe('FoodDelivery')
      expect(ast.modules.some((m) => m.name === 'Auth' && m.parent?.name === 'FoodDelivery')).toBe(true)
    }
  })

  it('updates an existing module parent instead of duplicating it', () => {
    const source = `module SYSTEM_Shop;
end_module;
module Auth;
end_module`
    const next = setModuleParent(source, 'Auth', 'Shop')
    expect(next).toContain('module Auth / Shop;')
    expect(next.match(/module Auth/g)?.length).toBe(1)
    const added = addModule(source, 'Auth', { parentName: 'Shop' })
    expect(added).toContain('module Auth / Shop;')
    expect(added.match(/module Auth/g)?.length).toBe(1)
  })

  it('inserts a new inv section after var, not before const', () => {
    const source = `module M;
const
  n = 1;
type
  T = nat;
var
  x: T;
process P ()
    pre
        true
    post
        true
end_process
end_module`
    const next = insertInvLine(source, 'M', 'x > 0 implies x < n')
    expect(next).toBeTruthy()
    const invAt = next!.indexOf('\ninv')
    expect(invAt).toBeGreaterThan(next!.indexOf('x: T'))
    expect(invAt).toBeLessThan(next!.indexOf('process P'))
    expect(invAt).toBeGreaterThan(next!.indexOf('const'))
  })
})
