/**
 * Derive Functional Scenario Form from process pre/post specifications.
 *
 * FSF is a semantic form (Spre ∧ Gi ∧ Di), not a source language.
 * `FSF :` in .asfl is an Agile-SOFL Editor internal DSL only.
 */

import type {
  ConditionClauseNode,
  FsfSpecNode,
  FsfScenarioNode,
  PredicateNode,
  ProcessNode,
  AtomicPredicateNode
} from '../ast/nodes.js'
import { printConditionText } from '../prepost/clause.js'
import { EMPTY_SPAN } from '../ast/span.js'

export type FsfDerivationSource = 'derived' | 'editor-internal-dsl'

export interface DerivedFunctionalScenario {
  id: string
  name: string
  kind: 'normal' | 'exceptional'
  guard: string
  definingCondition: string
  testCondition: string
  atomicPredicates: string[]
  expression: string
}

export interface FunctionalScenarioForm {
  processName: string
  source: FsfDerivationSource
  precondition: string
  scenarios: DerivedFunctionalScenario[]
  exceptionalScenarios: DerivedFunctionalScenario[]
  /** AST projection for tools that still consume FsfSpecNode. */
  fsf: FsfSpecNode
}

function relOp(kind: string | undefined): string {
  switch (kind) {
    case 'eq':
      return '='
    case 'neq':
      return '<>'
    case 'lt':
      return '<'
    case 'le':
      return '<='
    case 'gt':
      return '>'
    case 'ge':
      return '>='
    case 'inset':
      return 'inset'
    case 'notin':
      return 'notin'
    default:
      return '='
  }
}

function printNode(node: unknown): string {
  if (!node || typeof node !== 'object') return 'true'
  const n = node as Record<string, unknown>
  switch (n.type) {
    case 'informal_text':
      return String(n.text ?? '')
    case 'boolean_literal':
      return n.value ? 'true' : 'false'
    case 'identifier':
      return String(n.name ?? '')
    case 'number_literal':
      return String(n.value ?? '')
    case 'string_literal':
      return `"${n.value ?? ''}"`
    case 'char_literal':
      return `'${n.value ?? ''}'`
    case 'not_predicate':
      return `not ${printNode(n.operand)}`
    case 'paren_predicate':
    case 'paren_expr':
      return `(${printNode(n.inner)})`
    case 'relational_expr':
      return `${printNode(n.left)} ${relOp(n.kind as string)} ${printNode(n.right)}`
    case 'binary_op':
      return `${printNode(n.left)} ${n.op ?? ''} ${printNode(n.right)}`
    case 'unary_minus':
      return `-${printNode(n.operand)}`
    case 'field_access':
      return `${printNode(n.object)}.${n.field ?? n.name}`
    case 'call':
      return `${typeof n.callee === 'string' ? n.callee : printNode(n.callee)}(${(n.args as unknown[] | undefined)?.map(printNode).join(', ') ?? ''})`
    default:
      if (typeof n.name === 'string') return n.name
      if (n.value !== undefined) return String(n.value)
      return 'true'
  }
}

function atomText(atom: AtomicPredicateNode): string {
  return printNode(atom)
}

function printLocalPredicate(pred: PredicateNode): string {
  return pred.disjuncts
    .map((conj) => conj.atoms.map(atomText).filter(Boolean).join(' and '))
    .filter(Boolean)
    .join(' or ')
}

function informalPredicate(text: string, span = EMPTY_SPAN): PredicateNode {
  const body = text.trim() || 'true'
  return {
    type: 'predicate',
    span,
    disjuncts: [
      {
        type: 'conjunction',
        span,
        atoms: [{ type: 'informal_text', span, text: body }]
      }
    ]
  }
}

function clauseToPredicate(clause: ConditionClauseNode | undefined): PredicateNode {
  if (!clause) {
    return {
      type: 'predicate',
      span: EMPTY_SPAN,
      disjuncts: [{ type: 'conjunction', span: EMPTY_SPAN, atoms: [{ type: 'boolean_literal', span: EMPTY_SPAN, value: true }] }]
    }
  }
  if (clause.predicate) return clause.predicate
  return informalPredicate(printConditionText(clause) || clause.text, clause.span)
}

function predicateText(pred: PredicateNode): string {
  const printed = printLocalPredicate(pred).trim()
  return printed || 'true'
}

function andText(left: string, right: string): string {
  const l = left.trim()
  const r = right.trim()
  if (!l || l === 'true') return r || 'true'
  if (!r || r === 'true') return l
  return `${l} and ${r}`
}

function flattenStructuredPost(
  post: ConditionClauseNode
): Array<{ guard: ConditionClauseNode; def: ConditionClauseNode }> {
  if (post.kind === 'structured' && post.conditional) {
    const { guard, thenClause, elseClause } = post.conditional
    const rows = flattenStructuredPost(thenClause).map((row) => ({
      guard: {
        type: 'condition_clause' as const,
        span: post.span,
        kind: 'natural-language' as const,
        text: andText(printConditionText(guard), printConditionText(row.guard))
      },
      def: row.def
    }))
    if (elseClause) {
      const elseRows = flattenStructuredPost(elseClause)
      const notGuard: ConditionClauseNode = {
        type: 'condition_clause',
        span: guard.span,
        kind: 'natural-language',
        text: `not (${printConditionText(guard)})`
      }
      for (const row of elseRows) {
        rows.push({
          guard: {
            type: 'condition_clause',
            span: post.span,
            kind: 'natural-language',
            text: andText(printConditionText(notGuard), printConditionText(row.guard))
          },
          def: row.def
        })
      }
    }
    if (rows.length) return rows
    return [
      { guard, def: thenClause },
      ...(elseClause
        ? [
            {
              guard: {
                type: 'condition_clause' as const,
                span: guard.span,
                kind: 'natural-language' as const,
                text: `not (${printConditionText(guard)})`
              },
              def: elseClause
            }
          ]
        : [])
    ]
  }
  return [
    {
      guard: {
        type: 'condition_clause',
        span: post.span,
        kind: 'formal',
        text: 'true',
        predicate: {
          type: 'predicate',
          span: post.span,
          disjuncts: [
            { type: 'conjunction', span: post.span, atoms: [{ type: 'boolean_literal', span: post.span, value: true }] }
          ]
        }
      },
      def: post
    }
  ]
}

function toDerivedScenario(
  processName: string,
  index: number,
  kind: 'normal' | 'exceptional',
  preText: string,
  guard: string,
  def: string,
  name?: string
): DerivedFunctionalScenario {
  const testCondition = kind === 'exceptional' ? `not (${preText || 'Spre'})` : andText(preText, guard)
  const expression = andText(testCondition, def)
  return {
    id: `${processName}-${kind === 'exceptional' ? 'E' : 'S'}${index}`,
    name: name ?? (kind === 'exceptional' ? 'Precondition violated' : `Scenario ${index}`),
    kind,
    guard,
    definingCondition: def,
    testCondition,
    atomicPredicates: [preText, guard, def].filter((s) => s && s !== 'true'),
    expression
  }
}

function fsfFromLegacy(process: ProcessNode): FunctionalScenarioForm | null {
  const fsf = process.body?.fsf
  if (!fsf) return null
  const preText = process.body?.pre ? printConditionText(process.body.pre) : ''
  const scenarios: DerivedFunctionalScenario[] = fsf.scenarios.map((s, i) => {
    const guard = predicateText(s.test)
    const def = predicateText(s.def)
    return toDerivedScenario(process.name, i + 1, 'normal', preText, guard, def)
  })
  const exceptionalScenarios: DerivedFunctionalScenario[] = []
  if (fsf.others) {
    exceptionalScenarios.push(
      toDerivedScenario(process.name, 1, 'exceptional', preText || 'true', 'others', predicateText(fsf.others), 'others')
    )
  }
  return {
    processName: process.name,
    source: 'editor-internal-dsl',
    precondition: preText,
    scenarios,
    exceptionalScenarios,
    fsf
  }
}

/**
 * Derive FSF from process pre/post. Falls back to editor-internal `FSF :` if present.
 */
export function deriveFsf(process: ProcessNode): FunctionalScenarioForm | null {
  const body = process.body
  if (!body) return null

  if (body.pre || body.post) {
    const preText = body.pre ? printConditionText(body.pre) : ''
    const post = body.post
    const rows = post ? flattenStructuredPost(post) : []
    const scenarios: DerivedFunctionalScenario[] = rows.map((row, i) =>
      toDerivedScenario(
        process.name,
        i + 1,
        'normal',
        preText,
        printConditionText(row.guard),
        printConditionText(row.def),
        i === 0 ? 'Success' : `Scenario ${i + 1}`
      )
    )
    const exceptionalScenarios: DerivedFunctionalScenario[] = body.pre
      ? [
          toDerivedScenario(
            process.name,
            1,
            'exceptional',
            preText,
            `not (${preText})`,
            'precondition violated',
            'Precondition violated'
          )
        ]
      : []

    const fsfScenarios: FsfScenarioNode[] = rows.map((row) => ({
      type: 'fsf_scenario',
      span: row.def.span,
      test: informalPredicate(andText(preText, printConditionText(row.guard)), row.guard.span),
      def: clauseToPredicate(row.def)
    }))
    const fsf: FsfSpecNode = {
      type: 'fsf_spec',
      span: body.post?.span ?? body.pre?.span ?? body.span,
      scenarios: fsfScenarios
    }
    return {
      processName: process.name,
      source: 'derived',
      precondition: preText,
      scenarios,
      exceptionalScenarios,
      fsf
    }
  }

  return fsfFromLegacy(process)
}

export function deriveAllFsf(processes: ProcessNode[]): FunctionalScenarioForm[] {
  const result: FunctionalScenarioForm[] = []
  for (const p of processes) {
    const form = deriveFsf(p)
    if (form) result.push(form)
  }
  return result
}
