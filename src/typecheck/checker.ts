/**
 * Static type checker for Agile-SOFL specifications.
 */

import type { ProgramNode, ModuleNode, ExpressionNode, TypeDeclNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import { typeExprToInternal, typesCompatible, typeToString, type InternalType } from './types.js'
import { isBuiltin } from './builtins.js'
import { resolveScope } from '../scope/resolver.js'

export interface TypeCheckResult {
  diagnostics: Diagnostic[]
}

const NUMERIC_TYPES = new Set(['nat0', 'nat', 'int', 'real'])

function inferExprType(expr: ExpressionNode, typeEnv: Map<string, InternalType>): InternalType {
  switch (expr.type) {
    case 'nil':
      return { kind: 'unknown' }
    case 'boolean_literal':
      return { kind: 'basic', name: 'bool' }
    case 'number_literal':
      return { kind: 'basic', name: expr.isReal ? 'real' : 'int' }
    case 'char_literal':
      return { kind: 'basic', name: 'char' }
    case 'string_literal':
    case 'seq_expr':
      if (expr.type === 'seq_expr' && expr.kind === 'string') {
        return { kind: 'basic', name: 'string' }
      }
      if (expr.type === 'seq_expr') return { kind: 'seq', element: { kind: 'unknown' } }
      return { kind: 'basic', name: 'string' }
    case 'enum_literal':
      return { kind: 'enum', values: [expr.value] }
    case 'identifier': {
      const t = typeEnv.get(expr.name)
      return t ?? { kind: 'unknown' }
    }
    case 'binary_op':
      return { kind: 'basic', name: 'int' }
    case 'unary_minus':
      return inferExprType(expr.operand, typeEnv)
    case 'set_expr':
      return { kind: 'set', element: { kind: 'unknown' } }
    case 'map_expr':
      return { kind: 'map', domain: { kind: 'unknown' }, range: { kind: 'unknown' } }
    case 'relational_expr':
      return { kind: 'basic', name: 'bool' }
    case 'call':
      if (typeof expr.callee === 'string' && isBuiltin(expr.callee)) {
        return { kind: 'basic', name: 'bool' }
      }
      return { kind: 'unknown' }
    case 'if_expr':
    case 'let_expr':
    case 'case_expr':
    case 'paren_expr':
      return expr.type === 'paren_expr'
        ? inferExprType(expr.inner, typeEnv)
        : { kind: 'unknown' }
    default:
      return { kind: 'unknown' }
  }
}

function buildTypeEnv(module: ModuleNode): Map<string, InternalType> {
  const env = new Map<string, InternalType>()
  for (const t of module.types) {
    env.set(t.name, typeExprToInternal(t.typeExpr))
  }
  for (const v of module.vars) {
    env.set(v.variable.name, typeExprToInternal(v.typeExpr))
  }
  return env
}

function checkModuleTypes(module: ModuleNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const typeEnv = buildTypeEnv(module)

  for (const v of module.vars) {
    const declared = typeExprToInternal(v.typeExpr)
    if (declared.kind === 'unknown') {
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

  for (const p of module.processes) {
    for (const group of [...p.inputs, ...p.outputs]) {
      const t = typeExprToInternal(group.typeExpr)
      if (t.kind === 'basic' && !NUMERIC_TYPES.has(t.name) && t.name !== 'bool' && t.name !== 'given') {
        // valid basic types for params
      }
    }
    if (p.body?.ext) {
      for (const ext of p.body.ext) {
        if (ext.access === 'wr' && ext.typeExpr) {
          const d = inferExprType(
            { type: 'identifier', span: ext.span, name: ext.name },
            typeEnv
          )
          if (d.kind !== 'unknown' && ext.typeExpr) {
            const extType = typeExprToInternal(ext.typeExpr)
            if (!typesCompatible(d, extType)) {
              diagnostics.push(
                createDiagnostic(
                  DiagnosticCodes.TYPE_MISMATCH,
                  `Type mismatch for ext wr '${ext.name}': expected ${typeToString(extType)}`,
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
    const ret = typeExprToInternal(f.returnType)
    if (f.body && !f.isUndefined) {
      const bodyType = inferExprType(f.body, typeEnv)
      if (bodyType.kind !== 'unknown' && ret.kind !== 'unknown' && !typesCompatible(bodyType, ret)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.TYPE_MISMATCH,
            `Function '${f.name}' return type ${typeToString(ret)} does not match body ${typeToString(bodyType)}`,
            'error',
            f.span
          )
        )
      }
    }
  }

  return diagnostics
}

export function typeCheck(program: ProgramNode): TypeCheckResult {
  const diagnostics: Diagnostic[] = []
  resolveScope(program)

  for (const mod of program.modules) {
    diagnostics.push(...checkModuleTypes(mod))
  }

  return { diagnostics }
}

export function resolveTypeDecl(decl: TypeDeclNode, env: Map<string, InternalType>): InternalType {
  const t = typeExprToInternal(decl.typeExpr)
  env.set(decl.name, t)
  return t
}
