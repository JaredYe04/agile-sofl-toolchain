/**
 * Resolve identifier references to symbol declarations.
 */

import type {
  ProgramNode,
  ModuleNode,
  IdentifierNode,
  FieldAccessNode,
  ProcessNode,
  ParamGroupNode,
  FunctionNode,
  NamedTypeNode
} from '../ast/nodes.js'
import type { Span } from '../ast/span.js'
import { findNodeAtOffset, type AstNode } from '../visitor/walk.js'
import {
  lookupSymbol,
  lookupModuleScope,
  type SymbolEntry,
  type ScopeResult,
  type ModuleScope
} from './resolver.js'

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
  return lookupModuleScope(scopeResult, mod.name)
}

function findEnclosingFunction(mod: ModuleNode, offset: number): FunctionNode | null {
  for (const fn of mod.functions) {
    if (offset >= fn.span.start && offset <= fn.span.end) return fn
  }
  return null
}

function functionLocalSymbol(
  fn: FunctionNode,
  name: string,
  moduleName: string
): SymbolEntry | null {
  for (const group of fn.params) {
    if (group.names.includes(name)) {
      return { kind: 'var', name, moduleName, span: group.span }
    }
  }
  return null
}

function findEnclosingProcess(mod: ModuleNode, offset: number): ProcessNode | null {
  for (const proc of mod.processes) {
    if (offset >= proc.span.start && offset <= proc.span.end) return proc
  }
  return null
}

function paramNameSpan(group: ParamGroupNode): Span {
  return group.span
}

function processLocalSymbol(
  proc: ProcessNode,
  name: string,
  moduleName: string
): SymbolEntry | null {
  for (const group of proc.inputs) {
    if (group.names.includes(name)) {
      return { kind: 'var', name, moduleName, span: paramNameSpan(group) }
    }
  }
  for (const group of proc.outputs) {
    if (group.names.includes(name)) {
      return { kind: 'var', name, moduleName, span: paramNameSpan(group) }
    }
  }
  if (proc.body) {
    for (const ext of proc.body.ext) {
      if (ext.name === name) {
        return { kind: 'var', name, moduleName, span: ext.span }
      }
    }
  }
  return null
}

function resolveProcessAlias(
  scopeResult: ScopeResult,
  currentMod: ModuleNode,
  proc: ProcessNode
): ReferenceTarget | null {
  const alias = proc.alias
  if (!alias) return null
  return resolveName(scopeResult, currentMod, alias.name, alias.module)
}

function resolveName(
  scopeResult: ScopeResult,
  currentMod: ModuleNode,
  name: string,
  moduleQualifier?: string,
  offset?: number
): ReferenceTarget | null {
  const scope = scopeForModule(scopeResult, currentMod)
  if (!scope) return null

  if (!moduleQualifier && offset !== undefined) {
    const proc = findEnclosingProcess(currentMod, offset)
    if (proc) {
      const local = processLocalSymbol(proc, name, currentMod.name)
      if (local) {
        return { symbol: local, module: currentMod, span: local.span }
      }
    }
    const fn = findEnclosingFunction(currentMod, offset)
    if (fn) {
      const local = functionLocalSymbol(fn, name, currentMod.name)
      if (local) {
        return { symbol: local, module: currentMod, span: local.span }
      }
    }
  }

  let symbol = lookupSymbol(scope, name, moduleQualifier, scopeResult)
  if (!symbol && moduleQualifier) {
    const modScope = lookupModuleScope(scopeResult, moduleQualifier)
    symbol = modScope?.symbols.get(name)
  }
  if (!symbol) {
    symbol = lookupSymbol(scope, name, undefined, scopeResult)
  }
  if (!symbol) return null

  const mod = scopeResult.scopes.get(symbol.moduleName)?.module ?? programModuleByName(scopeResult, symbol.moduleName)
  if (!mod) return null

  return { symbol, module: mod, span: symbol.span }
}

function programModuleByName(scopeResult: ScopeResult, name: string): ModuleNode | null {
  const modScope = lookupModuleScope(scopeResult, name)
  return modScope?.module ?? null
}

function referenceFromNode(
  node: AstNode,
  scopeResult: ScopeResult,
  currentMod: ModuleNode,
  offset: number
): ReferenceTarget | null {
  if (node.type === 'identifier') {
    const id = node as IdentifierNode
    const qualifier = id.qualified?.module
    return resolveName(scopeResult, currentMod, id.name, qualifier, offset)
  }
  if (node.type === 'field_access') {
    const fa = node as FieldAccessNode
    if (fa.object.type === 'identifier') {
      const obj = fa.object as IdentifierNode
      const modName = obj.qualified?.module ?? obj.name
      return resolveName(scopeResult, currentMod, fa.field, modName, offset)
    }
  }
  if (node.type === 'named_type') {
    const nt = node as NamedTypeNode
    return resolveName(scopeResult, currentMod, nt.qualified.name, nt.qualified.module, offset)
  }
  if (node.type === 'type_decl' || node.type === 'var_decl' || node.type === 'const_decl') {
    return null
  }
  if (node.type === 'process' || node.type === 'function') {
    return null
  }
  return null
}

/** Resolve a symbol by name in module context (fallback when offset lookup fails). */
export function resolveReferenceByName(
  scopeResult: ScopeResult,
  currentMod: ModuleNode,
  name: string,
  moduleQualifier?: string,
  offset?: number
): ReferenceTarget | null {
  return resolveName(scopeResult, currentMod, name, moduleQualifier, offset)
}

function resolveDeclarationTarget(
  node: AstNode,
  scopeResult: ScopeResult,
  currentMod: ModuleNode
): ReferenceTarget | null {
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
  return null
}

export function resolveReference(
  program: ProgramNode,
  scopeResult: ScopeResult,
  offset: number
): ReferenceTarget | null {
  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return null

  const proc = findEnclosingProcess(currentMod, offset)
  if (proc?.alias && offset >= proc.alias.span.start && offset <= proc.alias.span.end) {
    const aliasTarget = resolveProcessAlias(scopeResult, currentMod, proc)
    if (aliasTarget) return aliasTarget
  }

  const node = findNodeAtOffset(program, offset)
  if (!node) return null

  return referenceFromNode(node, scopeResult, currentMod, offset)
}

export function resolveDeclarationAtOffset(
  program: ProgramNode,
  scopeResult: ScopeResult,
  offset: number
): ReferenceTarget | null {
  const currentMod = moduleAtOffset(program, offset)
  if (!currentMod) return null

  const proc = findEnclosingProcess(currentMod, offset)
  if (proc?.alias && offset >= proc.alias.span.start && offset <= proc.alias.span.end) {
    const aliasTarget = resolveProcessAlias(scopeResult, currentMod, proc)
    if (aliasTarget) return aliasTarget
  }

  const node = findNodeAtOffset(program, offset)
  if (!node) return null

  return (
    resolveDeclarationTarget(node, scopeResult, currentMod) ??
    resolveReference(program, scopeResult, offset)
  )
}
