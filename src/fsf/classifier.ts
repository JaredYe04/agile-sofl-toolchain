/**
 * FSF formal / semi-formal classification per hybrid specification rules.
 */

import type { ProgramNode, ProcessNode, FunctionNode, FsfSpecNode, AtomicPredicateNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import { isInformalText } from '../ast/guards.js'

export interface FsfClassifyResult {
  diagnostics: Diagnostic[]
}

function atomIsFormal(atom: AtomicPredicateNode): boolean {
  if (isInformalText(atom)) return false
  if (atom.type === 'not_predicate') return atomIsFormal(atom.operand)
  if (atom.type === 'paren_predicate') return atomIsFormal(atom.inner)
  if (atom.type === 'quantified') return true
  return true
}

function fsfIsFormal(fsf: FsfSpecNode): boolean {
  for (const scenario of fsf.scenarios) {
    for (const conj of scenario.test.disjuncts) {
      for (const atom of conj.atoms) {
        if (!atomIsFormal(atom)) return false
      }
    }
    for (const conj of scenario.def.disjuncts) {
      for (const atom of conj.atoms) {
        if (!atomIsFormal(atom)) return false
      }
    }
  }
  if (fsf.others) {
    for (const conj of fsf.others.disjuncts) {
      for (const atom of conj.atoms) {
        if (!atomIsFormal(atom)) return false
      }
    }
  }
  return true
}

function checkProcessFsf(process: ProcessNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (!process.body?.fsf) return diagnostics

  const formal = fsfIsFormal(process.body.fsf)
  const hasDecom = !!process.body.decomposition
  const isBottom = !hasDecom

  if (isBottom && !formal) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.FSF_INFORMAL_BOTTOM,
        `Bottom-level process '${process.name}' should use formal FSF specification`,
        'warning',
        process.body.fsf.span
      )
    )
  }

  if (hasDecom && formal && process.body.comment) {
    // semi-formal expected for non-bottom with decom - informal text in comment is ok
  }

  if (hasDecom && formal && !process.body.comment) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.FSF_FORMAL_NON_BOTTOM,
        `Non-bottom process '${process.name}' with decomposition typically uses semi-formal FSF`,
        'info',
        process.body.fsf.span
      )
    )
  }

  if (process.body.fsf.scenarios.length > 0 && !process.body.fsf.others) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.FSF_MISSING_OTHERS,
        `Process '${process.name}' FSF may be incomplete without 'others &&' branch`,
        'info',
        process.body.fsf.span
      )
    )
  }

  return diagnostics
}

function checkFunctionFsf(fn: FunctionNode): Diagnostic[] {
  if (!fn.fsf) return []
  const formal = fsfIsFormal(fn.fsf)
  if (!formal) {
    return [
      createDiagnostic(
        DiagnosticCodes.FSF_INFORMAL_BOTTOM,
        `Function '${fn.name}' uses semi-formal FSF (acceptable)`,
        'info',
        fn.fsf.span
      )
    ]
  }
  return []
}

export function classifyFsf(program: ProgramNode): FsfClassifyResult {
  const diagnostics: Diagnostic[] = []
  for (const mod of program.modules) {
    for (const p of mod.processes) {
      diagnostics.push(...checkProcessFsf(p))
    }
    for (const f of mod.functions) {
      diagnostics.push(...checkFunctionFsf(f))
    }
  }
  return { diagnostics }
}
