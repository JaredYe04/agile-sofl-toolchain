/**
 * Static type checker for Agile-SOFL specifications.
 */

import type {
  ProgramNode,
  ModuleNode,
  ExpressionNode,
  TypeDeclNode,
  TypeExprNode,
  PredicateNode,
  AtomicPredicateNode,
  ParamGroupNode,
  QualifiedNameNode,
  BindingGroupNode,
  FunctionNode
} from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import {
  typeExprToInternal,
  typesCompatibleStrict,
  typeToString,
  resolveInternalType,
  unifyExprTypes,
  isNumericType,
  type InternalType
} from './types.js'
import { BUILTIN_FUNCTIONS, isBuiltin, type BuiltinSignature } from './builtins.js'
import { resolveScope, type ModuleScope, type ScopeResult } from '../scope/resolver.js'
import { isExpressionNode } from '../ast/guards.js'

export interface TypeCheckResult {
  diagnostics: Diagnostic[]
}

const BOOL_TYPE: InternalType = { kind: 'basic', name: 'bool' }

function qualifiedKey(q: QualifiedNameNode): string {
  return q.module ? `${q.module}.${q.name}` : q.name
}

function builtinReturnType(sigReturn: string): InternalType {
  switch (sigReturn) {
    case 'number':
      return { kind: 'basic', name: 'int' }
    case 'bool':
      return BOOL_TYPE
    case 'set':
      return { kind: 'set', element: { kind: 'unknown' } }
    case 'seq':
      return { kind: 'seq', element: { kind: 'unknown' } }
    case 'map':
      return { kind: 'map', domain: { kind: 'unknown' }, range: { kind: 'unknown' } }
    default:
      return { kind: 'unknown' }
  }
}

function inferBinaryOpType(
  op: ExpressionNode & { type: 'binary_op' },
  typeEnv: Map<string, InternalType>
): InternalType {
  const left = inferExprType(op.left, typeEnv)
  const right = inferExprType(op.right, typeEnv)
  if (op.op === '**') {
    return unifyExprTypes([left, right, { kind: 'basic', name: 'real' }])
  }
  if (['+', '-', '*', '/', 'div', 'rem', 'mod'].includes(op.op)) {
    if (isNumericType(left) || isNumericType(right) || left.kind === 'unknown' || right.kind === 'unknown') {
      return unifyExprTypes([left, right])
    }
  }
  return { kind: 'unknown' }
}

function lookupFieldType(objType: InternalType, field: string): InternalType | undefined {
  const t = objType
  if (t.kind === 'composed') {
    const f = t.fields.find((x) => x.name === field)
    return f?.type
  }
  if (t.kind === 'product') {
    const idx = Number.parseInt(field, 10)
    if (!Number.isNaN(idx) && idx >= 1 && idx <= t.elements.length) {
      return t.elements[idx - 1]
    }
  }
  return undefined
}

function addComprehensionBindings(
  bindings: BindingGroupNode[] | undefined,
  typeEnv: Map<string, InternalType>
): Map<string, InternalType> {
  const local = new Map(typeEnv)
  if (!bindings) return local
  for (const bg of bindings) {
    const bt = resolveInternalType(typeExprToInternal(bg.typeExpr), local)
    for (const n of bg.names) local.set(n, bt)
  }
  return local
}

function inferExprType(expr: ExpressionNode, typeEnv: Map<string, InternalType>): InternalType {
  switch (expr.type) {
    case 'nil':
      return { kind: 'unknown' }
    case 'boolean_literal':
      return BOOL_TYPE
    case 'number_literal': {
      if (expr.isReal) return { kind: 'basic', name: 'real' }
      const value = Number(expr.value)
      if (Number.isInteger(value) && value >= 0) {
        if (value === 0) return { kind: 'basic', name: 'nat0' }
        return { kind: 'basic', name: 'nat' }
      }
      return { kind: 'basic', name: 'int' }
    }
    case 'char_literal':
      return { kind: 'basic', name: 'char' }
    case 'string_literal':
    case 'seq_expr':
      if (expr.type === 'seq_expr' && expr.kind === 'string') {
        return { kind: 'basic', name: 'string' }
      }
      if (expr.type === 'seq_expr') {
        if (expr.kind === 'comprehension' && expr.compExpr) {
          const local = addComprehensionBindings(expr.compBindings, typeEnv)
          return { kind: 'seq', element: inferExprType(expr.compExpr, local) }
        }
        if (expr.elements?.length) {
          return {
            kind: 'seq',
            element: unifyExprTypes(expr.elements.map((e) => inferExprType(e, typeEnv)))
          }
        }
        return { kind: 'seq', element: { kind: 'unknown' } }
      }
      return { kind: 'basic', name: 'string' }
    case 'enum_literal':
      return { kind: 'enum', values: [expr.value] }
    case 'identifier': {
      const key = expr.qualified ? qualifiedKey(expr.qualified) : expr.name
      const t = typeEnv.get(key) ?? typeEnv.get(expr.name)
      return t ? resolveInternalType(t, typeEnv) : { kind: 'unknown' }
    }
    case 'binary_op':
      return inferBinaryOpType(expr, typeEnv)
    case 'unary_minus': {
      const operand = inferExprType(expr.operand, typeEnv)
      if (isNumericType(operand) || operand.kind === 'unknown') {
        return operand.kind === 'unknown' ? { kind: 'basic', name: 'int' } : operand
      }
      return { kind: 'unknown' }
    }
    case 'set_expr':
      if (expr.kind === 'comprehension' && expr.compExpr) {
        const local = addComprehensionBindings(expr.compBindings, typeEnv)
        return { kind: 'set', element: inferExprType(expr.compExpr, local) }
      }
      if (expr.elements?.length) {
        return {
          kind: 'set',
          element: unifyExprTypes(expr.elements.map((e) => inferExprType(e, typeEnv)))
        }
      }
      return { kind: 'set', element: { kind: 'unknown' } }
    case 'map_expr':
      if (expr.kind === 'comprehension' && (expr.compKey || expr.compValue)) {
        const local = addComprehensionBindings(expr.compBindings, typeEnv)
        return {
          kind: 'map',
          domain: expr.compKey ? inferExprType(expr.compKey, local) : { kind: 'unknown' },
          range: expr.compValue ? inferExprType(expr.compValue, local) : { kind: 'unknown' }
        }
      }
      if (expr.pairs?.length) {
        return {
          kind: 'map',
          domain: unifyExprTypes(expr.pairs.map((p) => inferExprType(p.key, typeEnv))),
          range: unifyExprTypes(expr.pairs.map((p) => inferExprType(p.value, typeEnv)))
        }
      }
      return { kind: 'map', domain: { kind: 'unknown' }, range: { kind: 'unknown' } }
    case 'relational_expr':
      return BOOL_TYPE
    case 'call': {
      const name =
        typeof expr.callee === 'string'
          ? expr.callee
          : expr.callee.type === 'identifier'
            ? expr.callee.name
            : undefined
      if (name && isBuiltin(name)) {
        return builtinReturnType(BUILTIN_FUNCTIONS[name].returnType)
      }
      if (name) {
        const fnKey = `@fn:${name}`
        const fnRet = typeEnv.get(fnKey)
        if (fnRet) return fnRet
      }
      if (typeof expr.callee !== 'string') {
        return inferExprType(expr.callee, typeEnv)
      }
      return { kind: 'unknown' }
    }
    case 'if_expr':
      return unifyExprTypes([
        inferExprType(expr.thenExpr, typeEnv),
        inferExprType(expr.elseExpr, typeEnv)
      ])
    case 'let_expr': {
      const local = new Map(typeEnv)
      for (const b of expr.bindings) {
        if (b.typeExpr) {
          for (const n of b.names) {
            local.set(n, resolveInternalType(typeExprToInternal(b.typeExpr), local))
          }
        } else if (b.value) {
          const vt = inferExprType(b.value, local)
          for (const n of b.names) local.set(n, vt)
        }
      }
      return inferExprType(expr.body, local)
    }
    case 'case_expr': {
      const branchTypes = expr.alternatives.map((a) => inferExprType(a.expr, typeEnv))
      if (expr.default) branchTypes.push(inferExprType(expr.default, typeEnv))
      return unifyExprTypes(branchTypes)
    }
    case 'field_access': {
      const obj = inferExprType(expr.object, typeEnv)
      const ft = lookupFieldType(resolveInternalType(obj, typeEnv), expr.field)
      return ft ?? { kind: 'unknown' }
    }
    case 'index_access': {
      const obj = resolveInternalType(inferExprType(expr.object, typeEnv), typeEnv)
      if (obj.kind === 'seq') return obj.element
      if (obj.kind === 'map') return obj.range
      if (obj.kind === 'set') return BOOL_TYPE
      return { kind: 'unknown' }
    }
    case 'mk_expr': {
      const key = qualifiedKey(expr.typeName)
      const t = typeEnv.get(key) ?? typeEnv.get(expr.typeName.name)
      return t ? resolveInternalType(t, typeEnv) : { kind: 'unknown' }
    }
    case 'modify_expr':
      return inferExprType(expr.target, typeEnv)
    case 'paren_expr':
      return inferExprType(expr.inner, typeEnv)
    default:
      return { kind: 'unknown' }
  }
}

function moduleTypeChain(module: ModuleNode, scopes: Map<string, ModuleScope>): ModuleNode[] {
  const chain: ModuleNode[] = []
  let scope = scopes.get(module.name)
  const ancestors: ModuleNode[] = []
  while (scope?.parent) {
    ancestors.unshift(scope.parent.module)
    scope = scope.parent
  }
  chain.push(...ancestors, module)
  return chain
}

function buildTypeEnv(module: ModuleNode, scopes?: Map<string, ModuleScope>): Map<string, InternalType> {
  const env = new Map<string, InternalType>()
  const chain = scopes ? moduleTypeChain(module, scopes) : [module]
  for (const mod of chain) {
    for (const t of mod.types) {
      env.set(t.name, typeExprToInternal(t.typeExpr))
    }
  }
  for (const mod of chain) {
    for (const t of mod.types) {
      env.set(t.name, resolveInternalType(env.get(t.name)!, env))
    }
  }
  for (const v of module.vars) {
    env.set(v.variable.name, resolveInternalType(typeExprToInternal(v.typeExpr), env))
  }
  for (const c of module.consts) {
    env.set(c.name, inferExprType(c.value, env))
  }
  for (const p of module.processes) {
    for (const group of [...p.inputs, ...p.outputs]) {
      addParamGroupToEnv(group, env)
    }
  }
  for (const f of module.functions) {
    for (const group of f.params) {
      addParamGroupToEnv(group, env)
    }
    env.set(
      `@fn:${f.name}`,
      resolveInternalType(typeExprToInternal(f.returnType), env)
    )
  }
  return env
}

function addParamGroupToEnv(group: ParamGroupNode, env: Map<string, InternalType>): void {
  const t = resolveInternalType(typeExprToInternal(group.typeExpr), env)
  for (const name of group.names) {
    env.set(name, t)
  }
}

function isResolvedType(t: InternalType): boolean {
  return t.kind !== 'named' && t.kind !== 'unknown'
}

function validateTypeExpr(
  typeExpr: TypeExprNode,
  env: Map<string, InternalType>,
  label: string,
  span: import('../ast/span.js').Span
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const raw = typeExprToInternal(typeExpr)
  const resolved = resolveInternalType(raw, env)
  if (raw.kind === 'named' && resolved.kind === 'named') {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.UNKNOWN_TYPE,
        `Unknown type '${raw.module ? `${raw.module}.` : ''}${raw.name}' for ${label}`,
        'error',
        span
      )
    )
  } else if (resolved.kind === 'unknown') {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.UNKNOWN_TYPE,
        `Unknown type for ${label}`,
        'error',
        span
      )
    )
  }
  return diagnostics
}

function checkAtomicPredicate(
  atom: AtomicPredicateNode,
  typeEnv: Map<string, InternalType>,
  diagnostics: Diagnostic[],
  context: string
): void {
  switch (atom.type) {
    case 'relational_expr':
      inferExprType(atom.left, typeEnv)
      inferExprType(atom.right, typeEnv)
      if (atom.chainMid) inferExprType(atom.chainMid, typeEnv)
      if (atom.chainHigh) inferExprType(atom.chainHigh, typeEnv)
      break
    case 'not_predicate':
      checkAtomicPredicate(atom.operand, typeEnv, diagnostics, context)
      break
    case 'paren_predicate':
      checkAtomicPredicate(atom.inner, typeEnv, diagnostics, context)
      break
    case 'quantified': {
      const local = new Map(typeEnv)
      for (const bg of atom.bindings) {
        const bt = resolveInternalType(typeExprToInternal(bg.typeExpr), local)
        for (const n of bg.names) local.set(n, bt)
      }
      checkPredicate(atom.body, local, diagnostics, context)
      break
    }
    case 'informal_text':
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.FSF_FORMAL_NON_BOTTOM,
          `Semi-formal predicate in ${context}`,
          'info',
          atom.span
        )
      )
      break
    default:
      if (isExpressionNode(atom)) {
        const t = inferExprType(atom, typeEnv)
        if (t.kind !== 'unknown' && !typesCompatibleStrict(t, BOOL_TYPE)) {
          diagnostics.push(
            createDiagnostic(
              DiagnosticCodes.TYPE_MISMATCH,
              `Expected bool in ${context}, got ${typeToString(t)}`,
              'error',
              atom.span
            )
          )
        }
      }
  }
}

function checkPredicate(
  pred: PredicateNode,
  typeEnv: Map<string, InternalType>,
  diagnostics: Diagnostic[],
  context: string
): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      checkAtomicPredicate(atom, typeEnv, diagnostics, context)
    }
  }
}

function checkModuleTypes(module: ModuleNode, scopes: Map<string, ModuleScope>): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const typeEnv = buildTypeEnv(module, scopes)

  for (const t of module.types) {
    const raw = typeExprToInternal(t.typeExpr)
    const resolved = resolveInternalType(raw, typeEnv)
    if (raw.kind === 'named' && resolved.kind === 'named') {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.UNKNOWN_TYPE,
          `Unknown type alias '${t.name}'`,
          'error',
          t.span
        )
      )
    }
  }

  for (const v of module.vars) {
    const declared = resolveInternalType(typeExprToInternal(v.typeExpr), typeEnv)
    if (!isResolvedType(declared)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.UNKNOWN_TYPE,
          `Unknown type for variable '${v.variable.name}'`,
          'error',
          v.span
        )
      )
    }
  }

  for (const inv of module.invariants) {
    checkPredicate(inv.condition, typeEnv, diagnostics, `invariant`)
  }

  for (const p of module.processes) {
    for (const group of [...p.inputs, ...p.outputs]) {
      diagnostics.push(
        ...validateTypeExpr(
          group.typeExpr,
          typeEnv,
          `process '${p.name}' parameter`,
          group.span
        )
      )
    }
    if (p.body?.fsf) {
      for (const sc of p.body.fsf.scenarios) {
        checkPredicate(sc.test, typeEnv, diagnostics, `FSF test of process '${p.name}'`)
        checkPredicate(sc.def, typeEnv, diagnostics, `FSF def of process '${p.name}'`)
      }
      if (p.body.fsf.others) {
        checkPredicate(p.body.fsf.others, typeEnv, diagnostics, `FSF others of process '${p.name}'`)
      }
    }
    if (p.body?.ext) {
      for (const ext of p.body.ext) {
        if (ext.typeExpr) {
          const d = inferExprType(
            { type: 'identifier', span: ext.span, name: ext.name },
            typeEnv
          )
          if (d.kind !== 'unknown') {
            const extType = resolveInternalType(typeExprToInternal(ext.typeExpr), typeEnv)
            if (!typesCompatibleStrict(d, extType)) {
              diagnostics.push(
                createDiagnostic(
                  DiagnosticCodes.TYPE_MISMATCH,
                  `Type mismatch for ext ${ext.access} '${ext.name}': expected ${typeToString(extType)}, got ${typeToString(d)}`,
                  'error',
                  ext.span
                )
              )
            }
          }
        }
      }
    }
  }

  for (const f of module.functions) {
    for (const group of f.params) {
      diagnostics.push(
        ...validateTypeExpr(group.typeExpr, typeEnv, `function '${f.name}' parameter`, group.span)
      )
    }
    const ret = resolveInternalType(typeExprToInternal(f.returnType), typeEnv)
    if (!isResolvedType(ret)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.UNKNOWN_TYPE,
          `Unknown return type for function '${f.name}'`,
          'error',
          f.span
        )
      )
    }
    if (f.fsf) {
      for (const sc of f.fsf.scenarios) {
        checkPredicate(sc.test, typeEnv, diagnostics, `FSF test of function '${f.name}'`)
        checkPredicate(sc.def, typeEnv, diagnostics, `FSF def of function '${f.name}'`)
      }
      if (f.fsf.others) {
        checkPredicate(f.fsf.others, typeEnv, diagnostics, `FSF others of function '${f.name}'`)
      }
    }
    if (f.body && !f.isUndefined) {
      const bodyType = inferExprType(f.body, typeEnv)
      if (bodyType.kind !== 'unknown' && ret.kind !== 'unknown' && !typesCompatibleStrict(bodyType, ret)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.TYPE_MISMATCH,
            `Function '${f.name}' return type ${typeToString(ret)} does not match body ${typeToString(bodyType)}`,
            'error',
            f.span
          )
        )
      }
      checkExprCalls(f.body, typeEnv, diagnostics, module)
    }
  }

  for (const c of module.consts) {
    checkExprCalls(c.value, typeEnv, diagnostics, module)
  }

  return diagnostics
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return false
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++
      if (diff > 1) return false
    }
    return diff === 1
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let edits = 0
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++
      j++
      continue
    }
    edits++
    if (edits > 1) return false
    j++
  }
  return edits + (longer.length - j) <= 1
}

function isBuiltinTypo(name: string): boolean {
  if (isBuiltin(name)) return false
  return Object.keys(BUILTIN_FUNCTIONS).some((b) => editDistanceAtMostOne(name, b))
}

function callCalleeName(expr: ExpressionNode & { type: 'call' }): string | undefined {
  if (typeof expr.callee === 'string') return expr.callee
  if (expr.callee.type === 'identifier') return expr.callee.name
  return undefined
}

function functionParamTypes(fn: FunctionNode, typeEnv: Map<string, InternalType>): InternalType[] {
  const params: InternalType[] = []
  for (const group of fn.params) {
    const t = resolveInternalType(typeExprToInternal(group.typeExpr), typeEnv)
    for (let i = 0; i < group.names.length; i++) params.push(t)
  }
  return params
}

function matchesBuiltinArgKind(kind: string, argType: InternalType): boolean {
  if (argType.kind === 'unknown') return false
  switch (kind) {
    case 'number':
      return isNumericType(argType)
    case 'bool':
      return argType.kind === 'basic' && argType.name === 'bool'
    case 'set':
      return argType.kind === 'set'
    case 'seq':
      return argType.kind === 'seq'
    case 'map':
      return argType.kind === 'map'
    case 'identifier':
      return true
    default:
      return true
  }
}

function validateBuiltinCall(
  sig: BuiltinSignature,
  args: ExpressionNode[],
  typeEnv: Map<string, InternalType>,
  diagnostics: Diagnostic[],
  span: import('../ast/span.js').Span
): void {
  if (args.length !== sig.argTypes.length) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.TYPE_MISMATCH,
        `Builtin '${sig.name}' expects ${sig.argTypes.length} argument(s), got ${args.length}`,
        'error',
        span
      )
    )
    return
  }
  for (let i = 0; i < args.length; i++) {
    const argType = inferExprType(args[i], typeEnv)
    if (!matchesBuiltinArgKind(sig.argTypes[i], argType)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.TYPE_MISMATCH,
          `Argument ${i + 1} to '${sig.name}' expected ${sig.argTypes[i]}, got ${typeToString(argType)}`,
          'error',
          args[i].span
        )
      )
    }
  }
}

function validateUserCall(
  fn: FunctionNode,
  args: ExpressionNode[],
  typeEnv: Map<string, InternalType>,
  diagnostics: Diagnostic[],
  span: import('../ast/span.js').Span
): void {
  const paramTypes = functionParamTypes(fn, typeEnv)
  if (args.length !== paramTypes.length) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.TYPE_MISMATCH,
        `Function '${fn.name}' expects ${paramTypes.length} argument(s), got ${args.length}`,
        'error',
        span
      )
    )
    return
  }
  for (let i = 0; i < args.length; i++) {
    const argType = inferExprType(args[i], typeEnv)
    if (!typesCompatibleStrict(argType, paramTypes[i])) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.TYPE_MISMATCH,
          `Argument ${i + 1} to '${fn.name}' expected ${typeToString(paramTypes[i])}, got ${typeToString(argType)}`,
          'error',
          args[i].span
        )
      )
    }
  }
}

function checkExprCalls(
  expr: ExpressionNode,
  typeEnv: Map<string, InternalType>,
  diagnostics: Diagnostic[],
  module: ModuleNode
): void {
  if (expr.type === 'call') {
    const name = callCalleeName(expr)
    if (name && isBuiltinTypo(name)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.INVALID_BUILTIN,
          `Unknown builtin function '${name}'`,
          'error',
          expr.span
        )
      )
    } else if (name && isBuiltin(name)) {
      validateBuiltinCall(BUILTIN_FUNCTIONS[name], expr.args, typeEnv, diagnostics, expr.span)
    } else if (name) {
      const fn = module.functions.find((f) => f.name === name)
      if (fn) validateUserCall(fn, expr.args, typeEnv, diagnostics, expr.span)
    }
  }
  switch (expr.type) {
    case 'binary_op':
      checkExprCalls(expr.left, typeEnv, diagnostics, module)
      checkExprCalls(expr.right, typeEnv, diagnostics, module)
      break
    case 'let_expr':
      for (const b of expr.bindings) {
        if (b.value) checkExprCalls(b.value, typeEnv, diagnostics, module)
      }
      checkExprCalls(expr.body, typeEnv, diagnostics, module)
      break
    case 'if_expr':
      checkExprCalls(expr.thenExpr, typeEnv, diagnostics, module)
      checkExprCalls(expr.elseExpr, typeEnv, diagnostics, module)
      break
    case 'case_expr':
      for (const a of expr.alternatives) checkExprCalls(a.expr, typeEnv, diagnostics, module)
      if (expr.default) checkExprCalls(expr.default, typeEnv, diagnostics, module)
      break
    case 'call':
      for (const a of expr.args) checkExprCalls(a, typeEnv, diagnostics, module)
      break
    case 'paren_expr':
      checkExprCalls(expr.inner, typeEnv, diagnostics, module)
      break
    case 'field_access':
      checkExprCalls(expr.object, typeEnv, diagnostics, module)
      break
    case 'index_access':
      checkExprCalls(expr.object, typeEnv, diagnostics, module)
      checkExprCalls(expr.index, typeEnv, diagnostics, module)
      break
    case 'modify_expr':
      checkExprCalls(expr.target, typeEnv, diagnostics, module)
      for (const f of expr.fields) checkExprCalls(f.value, typeEnv, diagnostics, module)
      break
    case 'mk_expr':
      for (const a of expr.args) checkExprCalls(a, typeEnv, diagnostics, module)
      break
    default:
      break
  }
}

export function typeCheck(program: ProgramNode, scopeResult?: ScopeResult): TypeCheckResult {
  const diagnostics: Diagnostic[] = []
  const scopes = scopeResult ?? resolveScope(program)

  for (const mod of program.modules) {
    diagnostics.push(...checkModuleTypes(mod, scopes.scopes))
  }

  return { diagnostics }
}

export function resolveTypeDecl(decl: TypeDeclNode, env: Map<string, InternalType>): InternalType {
  const t = resolveInternalType(typeExprToInternal(decl.typeExpr), env)
  env.set(decl.name, t)
  return t
}
