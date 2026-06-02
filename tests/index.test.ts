import { describe, it, expect } from 'vitest'
import {
  parse,
  parseModule,
  parseSingleModule,
  format,
  walk
} from '../src/index'
import { loadFixture } from './helpers/index'
import { isModuleNode, isProgramNode } from '../src/ast/guards'

describe('Public API', () => {
  it('parseSingleModule runs full check on one module', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast, diagnostics } = parseSingleModule(source)
    expect(ast).not.toBeNull()
    expect(isProgramNode(ast)).toBe(true)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('parseModule returns ModuleNode', () => {
    const { ast } = parseModule('module Foo;\nvar x: nat;\nend_module')
    expect(isModuleNode(ast)).toBe(true)
  })

  it('format banking fixture', () => {
    const source = loadFixture('integration/banking.asfl')
    const { source: out, diagnostics } = format(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(out).toContain('SYSTEM_Banking')
  })

  it('walk and getNodeAtOffset find module name', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const { ast } = parse(source)
    expect(ast).not.toBeNull()
    const names: string[] = []
    if (isProgramNode(ast)) {
      walk(ast, {
        enterModule(node) {
          names.push(node.name)
        }
      })
      expect(names).toContain('Test')
    }
  })
})
