import { describe, it, expect } from 'vitest'
import { format, parse } from '../../src/index'
import { loadFixture, expectParseOk } from '../helpers/index'
import { isProgramNode } from '../../src/ast/guards'

describe('Parser - hybrid dialect sugar', () => {
  it('parses implicit composed field lists', () => {
    const source = `module Auth;
type
  UserAccount = user_id: nat, role: Role, balance: real;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const t = ast.modules[0]!.types[0]!
      expect(t.name).toBe('UserAccount')
      expect(t.typeExpr.type).toBe('composed_type')
      if (t.typeExpr.type === 'composed_type') {
        expect(t.typeExpr.fields.map((f) => f.name)).toEqual(['user_id', 'role', 'balance'])
      }
    }
    const printed = format(source).source
    expect(printed).toContain('composed of')
    expect(printed).toContain('user_id:')
    expect(printed).not.toMatch(/UserAccount = user_id:/)
  })

  it('parses Chinese seq/set suffixes and arrow maps', () => {
    const source = `module M;
type T = nat;
var
  log: T 序列;
  ids: T 集合;
  quotes: 股票代码 -> T;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const vars = ast.modules[0]!.vars
      expect(vars[0]!.typeExpr.type).toBe('seq_type')
      expect(vars[1]!.typeExpr.type).toBe('set_type')
      expect(vars[2]!.typeExpr.type).toBe('map_type')
    }
    const printed = format(source).source
    expect(printed).toContain('seq of')
    expect(printed).toContain('set of')
    expect(printed).toMatch(/map .+ to /)
    expect(printed).not.toContain('序列')
    expect(printed).not.toContain('集合')
    expect(printed).not.toContain('->')
  })

  it('parses time as a basic type', () => {
    const source = `module M;
type Stamp = time;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0]!.types[0]!.typeExpr).toMatchObject({ type: 'basic_type', name: 'time' })
    }
  })

  it('allows process before var/inv', () => {
    const source = `module M;
type T = nat;
process P (x: nat) ok: bool
    pre
        true
    post
        ok = true
end_process;
var x: T;
inv
    true;
end_module`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      expect(ast.modules[0]!.processes.map((p) => p.name)).toEqual(['P'])
      expect(ast.modules[0]!.vars[0]!.variable.name).toBe('x')
      expect(ast.modules[0]!.invariants).toHaveLength(1)
    }
  })

  it('parses GUI screens with natural-language bodies', () => {
    const source = `module GUI;
gui GUI_GUI;
  screen LoginView;
登录视图：输入用户名与密码。
  end_screen;
end_gui;
end_module;`
    const ast = expectParseOk(source, parse)
    if (isProgramNode(ast)) {
      const gui = ast.modules[0]!.gui
      expect(gui?.screens[0]?.name).toBe('LoginView')
      expect(gui?.screens[0]?.widgets.some((w) => w.text.includes('登录视图'))).toBe(true)
    }
  })

  it('parses the agent trading hybrid fixture', () => {
    const source = loadFixture('hybrid/agent-trading.asfl')
    const { ast, diagnostics } = parse(source)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    expect(errors, errors.map((e) => `${e.message} @${e.span.line}`).join('\n')).toHaveLength(0)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      expect(ast.modules.map((m) => m.name)).toEqual([
        'Auth',
        'MarketData',
        'Trading',
        'Account',
        'RiskControl',
        'WatchAlert',
        'Query',
        'Notification',
        'GUI'
      ])
      const auth = ast.modules[0]!
      expect(auth.processes.map((p) => p.name)).toEqual(['Login', 'Logout', 'CheckPermission'])
      expect(auth.invariants.length).toBeGreaterThan(0)
      expect(ast.modules.find((m) => m.name === 'GUI')?.gui?.screens.length).toBeGreaterThan(5)
    }
  })
})
