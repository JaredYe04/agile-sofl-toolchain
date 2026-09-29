/**
 * Data-refinement line: retrieve functions, given types, open operation-refinement obligations.
 */

import type { FunctionNode, ProgramNode, TypeExprNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'

export type DataRefinementItemKind = 'given' | 'retrieve' | 'obligation'

export interface DataRefinementItem {
  kind: DataRefinementItemKind
  typeName: string
  retrieveFunction?: string
  message: string
}

export interface DataRefinementReport {
  givenTypeCount: number
  missingRetrieveCount: number
  openObligationCount: number
  dataAmbiguity: number
  items: DataRefinementItem[]
  diagnostics: Diagnostic[]
}

function isGiven(type: TypeExprNode): boolean {
  return type.type === 'basic_type' && type.name === 'given'
}

function findFunction(program: ProgramNode, name: string): FunctionNode | undefined {
  for (const mod of program.modules) {
    const fn = mod.functions.find((f) => f.name === name)
    if (fn) return fn
  }
  return undefined
}

function typeNameOf(type: TypeExprNode | undefined): string | undefined {
  if (!type) return undefined
  if (type.type === 'named_type') return type.qualified.name
  if (type.type === 'basic_type') return type.name
  return undefined
}

export function checkDataRefine(program: ProgramNode): DataRefinementReport {
  const diagnostics: Diagnostic[] = []
  const items: DataRefinementItem[] = []
  let givenTypeCount = 0
  let missingRetrieveCount = 0
  let openObligationCount = 0

  const refinedAbstract = new Set<string>()

  for (const mod of program.modules) {
    for (const ty of mod.types) {
      if (isGiven(ty.typeExpr)) {
        givenTypeCount += 1
        const message = `Type '${ty.name}' is still given and needs a data refinement`
        items.push({ kind: 'given', typeName: ty.name, message })
        diagnostics.push(
          createDiagnostic(DiagnosticCodes.DATA_GIVEN, message, 'warning', ty.span)
        )
      }
    }

    const refine = mod.refine
    if (!refine) continue
    for (const item of refine.items) {
      refinedAbstract.add(item.abstractType)
      const fn = findFunction(program, item.retrieveFunction)
      if (!fn) {
        missingRetrieveCount += 1
        const message = `Retrieve function '${item.retrieveFunction}' for type '${item.abstractType}' is not defined`
        items.push({
          kind: 'retrieve',
          typeName: item.abstractType,
          retrieveFunction: item.retrieveFunction,
          message
        })
        diagnostics.push(
          createDiagnostic(DiagnosticCodes.DATA_RETRIEVE_MISSING, message, 'error', item.span)
        )
        continue
      }
      if (fn.isUndefined || !fn.body) {
        const message = `Retrieve function '${item.retrieveFunction}' has no formal body`
        items.push({
          kind: 'retrieve',
          typeName: item.abstractType,
          retrieveFunction: item.retrieveFunction,
          message
        })
        diagnostics.push(
          createDiagnostic(DiagnosticCodes.DATA_RETRIEVE_UNDEFINED, message, 'error', fn.span)
        )
        missingRetrieveCount += 1
        continue
      }
      const from = fn.params[0] ? typeNameOf(fn.params[0].typeExpr) : undefined
      const to = typeNameOf(fn.returnType)
      if (from !== item.representationType || to !== item.abstractType) {
        const message = `Retrieve '${item.retrieveFunction}' should have type ${item.representationType} -> ${item.abstractType}`
        items.push({
          kind: 'retrieve',
          typeName: item.abstractType,
          retrieveFunction: item.retrieveFunction,
          message
        })
        diagnostics.push(
          createDiagnostic(DiagnosticCodes.DATA_RETRIEVE_TYPE, message, 'error', fn.span)
        )
      }
      openObligationCount += 1
      const obligation = `Operation refinement obligation open for '${item.abstractType}' via retrieve '${item.retrieveFunction}' (discharge by review; no prover in this phase)`
      items.push({
        kind: 'obligation',
        typeName: item.abstractType,
        retrieveFunction: item.retrieveFunction,
        message: obligation
      })
      diagnostics.push(
        createDiagnostic(DiagnosticCodes.DATA_OBLIGATION_OPEN, obligation, 'info', item.span)
      )
    }
  }

  const dataAmbiguity = givenTypeCount + missingRetrieveCount + openObligationCount
  void refinedAbstract
  return {
    givenTypeCount,
    missingRetrieveCount,
    openObligationCount,
    dataAmbiguity,
    items,
    diagnostics
  }
}
