/**
 * Undefined symbol reference checking (ASFL_SCOPE_001).
 */

import type {
  ProgramNode,
  ModuleNode,
  IdentifierNode,
  ExpressionNode,
  TypeExprNode,
  AtomicPredicateNode,
  ProcessNode,
  ParamGroupNode,
  PredicateNode,
  FsfSpecNode
} from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import type { Span } from '../ast/span.js'
import { resolveReference, resolveDeclarationAtOffset, resolveReferenceByName } from './reference.js'
import type { ScopeResult } from './resolver.js'

export interface ReferenceCheckResult {
  diagnostics: Diagnostic[]
}

interface RefSite {
  span: Span
  offset: number
  name: string
  moduleQualifier?: string
}

function moduleAtOffset(program: ProgramNode, offset: number): ModuleNode | null {
  for (const mod of program.modules) {
    if (offset >= mod.span.start && offset <= mod.span.end) return mod
  }
  return null
}

function isDeclNameOffset(
  program: ProgramNode,
  scopeResult: ScopeResult,
  offset: number
): boolean {
  const decl = resolveDeclarationAtOffset(program, scopeResult, offset)
  if (!decl) return false
  return offset >= decl.span.start && offset <= decl.span.end
}

function collectRefSites(program: ProgramNode): RefSite[] {
  const sites: RefSite[] = []
  for (const mod of program.modules) {
    collectModuleRefSites(mod, sites)
  }
  return sites
}

function pushSite(
  sites: RefSite[],
  span: Span,
  name: string,
  offset?: number,
  moduleQualifier?: string
): void {
  if (span.end <= span.start) return
  sites.push({ span, offset: offset ?? span.start, name, moduleQualifier })
}

function pushIdentifier(sites: RefSite[], id: IdentifierNode): void {
  pushSite(sites, id.span, id.name, undefined, id.qualified?.module)
}

function paramNames(groups: ParamGroupNode[]): Set<string> {
  const names = new Set<string>()
  for (const g of groups) {
    for (const n of g.names) names.add(n)
  }
  return names
}

function collectModuleRefSites(mod: ModuleNode, sites: RefSite[]): void {
  for (const c of mod.consts) {
    walkExpressionRefs(c.value, sites, new Set())
  }
  for (const t of mod.types) {
    if (t.parentType) pushQualifiedName(t.parentType, sites)
    walkTypeExprRefs(t.typeExpr, sites)
  }
  for (const v of mod.vars) {
    walkTypeExprRefs(v.typeExpr, sites)
  }
  for (const inv of mod.invariants) {
    walkPredicateRefs(inv.condition, sites, new Set())
  }
  for (const p of mod.processes) {
    for (const g of [...p.inputs, ...p.outputs]) {
      walkTypeExprRefs(g.typeExpr, sites)
    }
    if (p.alias) pushQualifiedName(p.alias, sites)
    walkProcessBodyRefs(p, sites)
  }
  for (const f of mod.functions) {
    for (const g of f.params) walkTypeExprRefs(g.typeExpr, sites)
    walkTypeExprRefs(f.returnType, sites)
    const fnLocals = paramNames(f.params)
    if (f.fsf) walkFsfRefs(f.fsf, sites, fnLocals)
    if (f.body) walkExpressionRefs(f.body, sites, fnLocals)
  }
}

function pushQualifiedName(
  q: { module?: string; name: string; span: Span },
  sites: RefSite[]
): void {
  pushSite(sites, q.span, q.name, undefined, q.module)
}

function walkProcessBodyRefs(proc: ProcessNode, sites: RefSite[]): void {
  const body = proc.body
  if (!body) return
  for (const ext of body.ext) {
    if (ext.typeExpr) walkTypeExprRefs(ext.typeExpr, sites)
  }
  const locals = paramNames([...proc.inputs, ...proc.outputs])
  for (const ext of body.ext ?? []) locals.add(ext.name)
  if (body.fsf) walkFsfRefs(body.fsf, sites, locals)
}

function walkFsfRefs(fsf: FsfSpecNode, sites: RefSite[], skipNames: Set<string>): void {
  for (const sc of fsf.scenarios) {
    walkPredicateRefs(sc.test, sites, skipNames)
    walkPredicateRefs(sc.def, sites, skipNames)
  }
  if (fsf.others) walkPredicateRefs(fsf.others, sites, skipNames)
}

function walkTypeExprRefs(type: TypeExprNode, sites: RefSite[]): void {
  switch (type.type) {
    case 'named_type':
      pushQualifiedName(type.qualified, sites)
      break
    case 'set_type':
    case 'seq_type':
      walkTypeExprRefs(type.element, sites)
      break
    case 'map_type':
      walkTypeExprRefs(type.domain, sites)
      walkTypeExprRefs(type.range, sites)
      break
    case 'product_type':
      for (const el of type.elements) walkTypeExprRefs(el, sites)
      break
    case 'union_type':
      for (const v of type.variants) walkTypeExprRefs(v, sites)
      break
    case 'composed_type':
      for (const f of type.fields) walkTypeExprRefs(f.typeExpr, sites)
      break
    default:
      break
  }
}

function walkPredicateRefs(pred: PredicateNode, sites: RefSite[], skipNames: Set<string>): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      walkAtomicRefs(atom, sites, skipNames)
    }
  }
}

function walkAtomicRefs(atom: AtomicPredicateNode, sites: RefSite[], skipNames: Set<string>): void {
  switch (atom.type) {
    case 'not_predicate':
      walkAtomicRefs(atom.operand, sites, skipNames)
      break
    case 'paren_predicate':
      walkAtomicRefs(atom.inner, sites, skipNames)
      break
    case 'informal_text':
      break
    case 'quantified': {
      const local = new Set(skipNames)
      for (const bg of atom.bindings) {
        for (const n of bg.names) local.add(n)
        walkTypeExprRefs(bg.typeExpr, sites)
      }
      for (const nested of atom.nestedQuantifiers) {
        for (const bg of nested.bindings) {
          for (const n of bg.names) local.add(n)
          walkTypeExprRefs(bg.typeExpr, sites)
        }
      }
      walkPredicateRefs(atom.body, sites, local)
      break
    }
    case 'boolean_literal':
      break
    default:
      walkExpressionRefs(atom as ExpressionNode, sites, skipNames)
  }
}

function walkExpressionRefs(expr: ExpressionNode, sites: RefSite[], skipNames: Set<string>): void {
  switch (expr.type) {
    case 'identifier':
      if (skipNames.has(expr.name)) return
      pushIdentifier(sites, expr)
      return
    case 'field_access':
      walkExpressionRefs(expr.object, sites, skipNames)
      return
    case 'binary_op':
      walkExpressionRefs(expr.left, sites, skipNames)
      walkExpressionRefs(expr.right, sites, skipNames)
      return
    case 'paren_expr':
      walkExpressionRefs(expr.inner, sites, skipNames)
      return
    case 'if_expr':
      walkPredicateRefs(expr.condition, sites, skipNames)
      walkExpressionRefs(expr.thenExpr, sites, skipNames)
      walkExpressionRefs(expr.elseExpr, sites, skipNames)
      return
    case 'let_expr': {
      const local = new Set(skipNames)
      for (const b of expr.bindings) {
        if (b.typeExpr) {
          for (const n of b.names) local.add(n)
          walkTypeExprRefs(b.typeExpr, sites)
        }
        if (b.guard) walkPredicateRefs(b.guard, sites, local)
        if (b.value) {
          walkExpressionRefs(b.value, sites, local)
          if (!b.typeExpr) for (const n of b.names) local.add(n)
        }
      }
      walkExpressionRefs(expr.body, sites, local)
      return
    }
    case 'relational_expr':
      walkExpressionRefs(expr.left, sites, skipNames)
      if (expr.chainMid) walkExpressionRefs(expr.chainMid, sites, skipNames)
      if (expr.chainHigh) walkExpressionRefs(expr.chainHigh, sites, skipNames)
      walkExpressionRefs(expr.right, sites, skipNames)
      return
    case 'unary_minus':
      walkExpressionRefs(expr.operand, sites, skipNames)
      return
    case 'index_access':
      walkExpressionRefs(expr.object, sites, skipNames)
      walkExpressionRefs(expr.index, sites, skipNames)
      return
    case 'mk_expr':
      pushQualifiedName(expr.typeName, sites)
      for (const a of expr.args) walkExpressionRefs(a, sites, skipNames)
      return
    case 'modify_expr':
      walkExpressionRefs(expr.target, sites, skipNames)
      for (const f of expr.fields) walkExpressionRefs(f.value, sites, skipNames)
      return
    case 'set_expr':
    case 'seq_expr':
      if (expr.elements) {
        for (const el of expr.elements) walkExpressionRefs(el, sites, skipNames)
      }
      if (expr.rangeLow) walkExpressionRefs(expr.rangeLow, sites, skipNames)
      if (expr.rangeHigh) walkExpressionRefs(expr.rangeHigh, sites, skipNames)
      if (expr.kind === 'comprehension') {
        const local = new Set(skipNames)
        if (expr.compBindings) {
          for (const bg of expr.compBindings) {
            for (const n of bg.names) local.add(n)
            walkTypeExprRefs(bg.typeExpr, sites)
          }
        }
        if (expr.compGuard) walkPredicateRefs(expr.compGuard, sites, local)
        if (expr.compExpr) walkExpressionRefs(expr.compExpr, sites, local)
      }
      return
    case 'map_expr':
      if (expr.pairs) {
        for (const p of expr.pairs) {
          walkExpressionRefs(p.key, sites, skipNames)
          walkExpressionRefs(p.value, sites, skipNames)
        }
      }
      if (expr.kind === 'comprehension') {
        const local = new Set(skipNames)
        if (expr.compBindings) {
          for (const bg of expr.compBindings) {
            for (const n of bg.names) local.add(n)
            walkTypeExprRefs(bg.typeExpr, sites)
          }
        }
        if (expr.compGuard) walkPredicateRefs(expr.compGuard, sites, local)
        if (expr.compKey) walkExpressionRefs(expr.compKey, sites, local)
        if (expr.compValue) walkExpressionRefs(expr.compValue, sites, local)
      }
      return
    case 'call':
      if (typeof expr.callee !== 'string') {
        walkExpressionRefs(expr.callee, sites, skipNames)
      }
      for (const a of expr.args) walkExpressionRefs(a, sites, skipNames)
      return
    case 'case_expr':
      walkExpressionRefs(expr.scrutinee, sites, skipNames)
      for (const alt of expr.alternatives) {
        walkExpressionRefs(alt.expr, sites, skipNames)
      }
      if (expr.default) walkExpressionRefs(expr.default, sites, skipNames)
      return
    default:
      break
  }
}

export function checkReferences(program: ProgramNode, scopeResult: ScopeResult): ReferenceCheckResult {
  const diagnostics: Diagnostic[] = []
  const seen = new Set<string>()
  const sites = collectRefSites(program)

  for (const site of sites) {
    const key = `${site.offset}:${site.span.end}`
    if (seen.has(key)) continue
    seen.add(key)

    if (isDeclNameOffset(program, scopeResult, site.offset)) continue

    const mod = moduleAtOffset(program, site.offset)
    const resolved =
      resolveReference(program, scopeResult, site.offset) ??
      (mod
        ? resolveReferenceByName(
            scopeResult,
            mod,
            site.name,
            site.moduleQualifier,
            site.offset
          )
        : null)
    if (resolved) continue

    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.UNDEFINED_SYMBOL,
        'Undefined symbol reference',
        'error',
        site.span
      )
    )
  }

  return { diagnostics }
}
