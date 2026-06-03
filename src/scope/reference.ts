/**
 * Resolve identifier references to symbol declarations.
 */

import type { ProgramNode, ModuleNode, IdentifierNode, FieldAccessNode } from '../ast/nodes.js'
import type { Span } from '../ast/span.js'
import { findNodeAtOffset, type AstNode } from '../visitor/walk.js'
import { lookupSymbol, type SymbolEntry, type ScopeResult, type ModuleScope } from './resolver.js'

export interface ReferenceTarget {
  symbol: SymbolEntry
  module: ModuleNode
  span: Span
}

function moduleAtOffset(program: ProgramNode, offset: number): ModuleNode | null {
  let best: ModuleNode | null = null
  let bestLen = Infinity
  for (const mod of program.modules) {
    const { span } = mod
    if (span.end <= span.start) continue
    if (offset >= span.start && offset <= span.end && span.end - span.start < bestLen) {
      best = mod
      bestLen = span.end - span.start
    }
  }
  return best
}

function scopeForModule(scopeResult: ScopeResult, mod: ModuleNode): ModuleScope | undefined {
  return findModuleScope(scopeResult, mod.name)
}

function findModuleScope(scopeResult: ScopeResult, moduleName: string): ModuleScope | undefined {
  if (!scopeResult.root) return undefined
  if (scopeResult.root.module.name === moduleName) return scopeResult.root
  const queue = [...scopeResult.root.children]
  while (queue.length) {
    const current = queue.shift()!
    if (current.module.name === moduleName) return current
    queue.push(...current.children)
  }
  return undefined
}

function resolveName(
  scopeResult: ScopeResult,
  currentMod: ModuleNode,
  name: string,
  moduleQualifier?: string
): ReferenceTarget | null {
  const scope = scopeForModule(scopeResult, currentMod)
  if (!scope) return null

  let symbol = lookupSymbol(scope, name, moduleQualifier)
  if (!symbol && moduleQualifier) {
    const modScope = findModuleScope(scopeResult, moduleQualifier)
    symbol = modScope?.symbols.get(name)
  }
  if (!symbol) {
    symbol = lookupSymbol(scope, name)
  }
  if (!symbol) return null

  const mod =
    scopeResult.root?.module.name === symbol.moduleName
      ? scopeResult.root.module
      : programModuleByName(scopeResult, symbol.moduleName)
  if (!mod) return null

  return { symbol, module: mod, span: symbol.span }
}

function programModuleByName(scopeResult: ScopeResult, name: string): ModuleNode | null {
  if (!scopeResult.root) return null
  const queue: ModuleScope[] = [scopeResult.root]
  while (queue.length) {
    const current = queue.shift()!
    if (current.module.name === name) return current.module
    queue.push(...current.children)
  }
  return null
}

function referenceFromNode(
  node: AstNode,
  scopeResult: ScopeResult,
  currentMod: ModuleNode
): ReferenceTarget | null {
  if (node.type === 'identifier') {
    const id = node as IdentifierNode
    const qualifier = id.qualified?.name
    return resolveName(scopeResult, currentMod, id.name, qualifier)
  }
  if (node.type === 'field_access') {
    const fa = node as FieldAccessNode
    if (fa.object.type === 'identifier') {
      const modName = fa.object.name
      return resolveName(scopeResult, currentMod, fa.field, modName)
    }
  }
  if (node.type === 'type_decl' || node.type === 'var_decl' || node.type === 'const_decl') {
    return null
  }
  if (node.type === 'process' || node.type === 'function') {
    return null
  }
  return null
}

export function resolveReference(
  program: ProgramNode,
  scopeResult: ScopeResult,
  offset: number
): ReferenceTarget | null {
  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return null

  const node = findNodeAtOffset(program, offset)
  if (!node) return null

  return referenceFromNode(node, scopeResult, currentMod)
}

export function resolveDeclarationAtOffset(
  program: ProgramNode,
  scopeResult: ScopeResult,
  offset: number
): ReferenceTarget | null {
  const node = findNodeAtOffset(program, offset)
  if (!node) return null

  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return null

  if (node.type === 'type_decl') {
    const sym = scopeForModule(scopeResult, currentMod)?.symbols.get(node.name)
    if (sym) return { symbol: sym, module: currentMod, span: node.span }
  }
  if (node.type === 'var_decl') {
    const sym = scopeForModule(scopeResult, currentMod)?.symbols.get(node.variable.name)
    if (sym) return { symbol: sym, module: currentMod, span: node.variable.span }
  }
  if (node.type === 'const_decl') {
    const sym = scopeForModule(scopeResult, currentMod)?.symbols.get(node.name)
    if (sym) return { symbol: sym, module: currentMod, span: node.span }
  }
  if (node.type === 'process') {
    const sym = scopeForModule(scopeResult, currentMod)?.symbols.get(node.name)
    if (sym) return { symbol: sym, module: currentMod, span: node.span }
  }
  if (node.type === 'function') {
    const sym = scopeForModule(scopeResult, currentMod)?.symbols.get(node.name)
    if (sym) return { symbol: sym, module: currentMod, span: node.span }
  }

  return resolveReference(program, scopeResult, offset)
}
