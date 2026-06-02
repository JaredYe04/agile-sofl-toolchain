/**
 * Module scope resolution and symbol tables.
 */

import type { ProgramNode, ModuleNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import { EMPTY_SPAN } from '../ast/span.js'

export type SymbolKind = 'const' | 'type' | 'var' | 'process' | 'function'

export interface SymbolEntry {
  kind: SymbolKind
  name: string
  moduleName: string
  span: typeof EMPTY_SPAN
}

export interface ModuleScope {
  module: ModuleNode
  parent?: ModuleScope
  symbols: Map<string, SymbolEntry>
  children: ModuleScope[]
}

export interface ScopeResult {
  root: ModuleScope | null
  symbols: SymbolEntry[]
  diagnostics: Diagnostic[]
}

function buildModuleScope(module: ModuleNode, parent?: ModuleScope): ModuleScope {
  const scope: ModuleScope = {
    module,
    parent,
    symbols: new Map(),
    children: []
  }

  for (const c of module.consts) {
    scope.symbols.set(c.name, { kind: 'const', name: c.name, moduleName: module.name, span: c.span })
  }
  for (const t of module.types) {
    scope.symbols.set(t.name, { kind: 'type', name: t.name, moduleName: module.name, span: t.span })
  }
  for (const v of module.vars) {
    scope.symbols.set(v.variable.name, { kind: 'var', name: v.variable.name, moduleName: module.name, span: v.span })
  }
  for (const p of module.processes) {
    scope.symbols.set(p.name, { kind: 'process', name: p.name, moduleName: module.name, span: p.span })
  }
  for (const f of module.functions) {
    scope.symbols.set(f.name, { kind: 'function', name: f.name, moduleName: module.name, span: f.span })
  }

  return scope
}

function linkParentChild(scopes: Map<string, ModuleScope>): void {
  for (const scope of scopes.values()) {
    const parentName = scope.module.parent?.name
    if (parentName) {
      const parent = scopes.get(parentName)
      if (parent) {
        scope.parent = parent
        parent.children.push(scope)
      }
    }
  }
}

export function resolveScope(program: ProgramNode): ScopeResult {
  const diagnostics: Diagnostic[] = []
  const scopes = new Map<string, ModuleScope>()

  for (const mod of program.modules) {
    if (scopes.has(mod.name)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.DUPLICATE_SYMBOL,
          `Duplicate module name: ${mod.name}`,
          'error',
          mod.span
        )
      )
    }
    scopes.set(mod.name, buildModuleScope(mod))
  }

  linkParentChild(scopes)

  const root = program.modules.find((m) => m.isSystem)
  const rootScope = root ? scopes.get(root.name) ?? null : scopes.values().next().value ?? null

  const allSymbols: SymbolEntry[] = []
  for (const scope of scopes.values()) {
    for (const sym of scope.symbols.values()) {
      allSymbols.push(sym)
    }
  }

  return { root: rootScope ?? null, symbols: allSymbols, diagnostics }
}

export function lookupSymbol(
  scope: ModuleScope,
  name: string,
  moduleQualifier?: string
): SymbolEntry | undefined {
  if (moduleQualifier) {
    let current: ModuleScope | undefined = scope
    while (current) {
      if (current.module.name === moduleQualifier || current.module.name.endsWith(moduleQualifier)) {
        return current.symbols.get(name)
      }
      current = findChildModule(current, moduleQualifier) ?? current.parent
    }
    return undefined
  }

  let current: ModuleScope | undefined = scope
  while (current) {
    const sym = current.symbols.get(name)
    if (sym) return sym
    current = current.parent
  }
  return undefined
}

function findChildModule(scope: ModuleScope, name: string): ModuleScope | undefined {
  for (const child of scope.children) {
    if (child.module.name === name) return child
    const found = findChildModule(child, name)
    if (found) return found
  }
  return undefined
}

export function checkVarWriteAccess(
  program: ProgramNode,
  varName: string,
  writerModule: string
): Diagnostic | null {
  const { root } = resolveScope(program)
  if (!root) return null

  let declaringScope: ModuleScope | undefined
  const findVar = (scope: ModuleScope): boolean => {
    if (scope.symbols.has(varName) && scope.symbols.get(varName)?.kind === 'var') {
      declaringScope = scope
      return true
    }
    for (const child of scope.children) {
      if (findVar(child)) return true
    }
    return false
  }
  findVar(root)

  if (!declaringScope) return null
  if (declaringScope.module.name !== writerModule) {
    return createDiagnostic(
      DiagnosticCodes.PARENT_VAR_WRITE,
      `Variable '${varName}' can only be written in module '${declaringScope.module.name}', not '${writerModule}'`,
      'error',
      EMPTY_SPAN
    )
  }
  return null
}
