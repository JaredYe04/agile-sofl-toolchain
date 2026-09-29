/**
 * Process atomicity and scenario-coverage obligations derived from pre/post (FSF).
 */

import type {
  AtomicPredicateNode,
  ConditionClauseNode,
  ModuleNode,
  PredicateNode,
  ProcessNode,
  ProgramNode,
  TypeExprNode
} from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { DiagnosticCodes } from '../diagnostics/codes.js'
import { checkCdfd } from '../cdfd/checkCdfd.js'
import { deriveFsf } from '../fsf/deriver.js'
import { clauseHasInformal } from '../prepost/clause.js'
import { isFsfFormal } from '../fsf/classifier.js'

export interface InformalAtomRef {
  key: string
  moduleName: string
  processName: string
  clause: 'pre' | 'post' | 'fsf'
  text: string
}

export interface ProcessAtomicity {
  moduleName: string
  processName: string
  hasDecom: boolean
  decomTarget?: string
  informalAtomCount: number
  typesDefined: boolean
  scenarioCoverageComplete: boolean
  onCdfd: boolean
  /** Signature-only process: no pre/post/fsf/decom/comment yet. */
  isStub: boolean
  /** All structural leaf conditions except DeclareAtomic. */
  structurallyAtomic: boolean
}

export interface ProcessAmbiguityReport {
  processes: ProcessAtomicity[]
  informalAtoms: InformalAtomRef[]
  informalAtomCount: number
  incompleteScenarioCount: number
  openConditionCount: number
  unbalancedBoundaryCount: number
  undeclaredAtomicCount: number
  emptyModuleCount: number
  stubProcessCount: number
  processAmbiguity: number
  diagnostics: Diagnostic[]
}

function walkAtoms(pred: PredicateNode | undefined, visit: (atom: AtomicPredicateNode) => void): void {
  if (!pred) return
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      if (atom.type === 'not_predicate') walkAtomsLike(atom.operand, visit)
      else if (atom.type === 'paren_predicate') walkAtomsLike(atom.inner, visit)
      else visit(atom)
    }
  }
}

function walkAtomsLike(atom: AtomicPredicateNode, visit: (atom: AtomicPredicateNode) => void): void {
  if (atom.type === 'not_predicate') walkAtomsLike(atom.operand, visit)
  else if (atom.type === 'paren_predicate') walkAtomsLike(atom.inner, visit)
  else visit(atom)
}

function informalFromClause(
  clause: ConditionClauseNode | undefined,
  moduleName: string,
  processName: string,
  which: 'pre' | 'post'
): InformalAtomRef[] {
  if (!clause) return []
  const refs: InformalAtomRef[] = []
  if (clause.kind === 'natural-language' && clause.text.trim()) {
    refs.push({
      key: `${moduleName}::${processName}::${which}::${clause.text.trim()}`,
      moduleName,
      processName,
      clause: which,
      text: clause.text.trim()
    })
    return refs
  }
  if (clause.conditional) {
    refs.push(
      ...informalFromClause(clause.conditional.guard, moduleName, processName, which),
      ...informalFromClause(clause.conditional.thenClause, moduleName, processName, which),
      ...informalFromClause(clause.conditional.elseClause, moduleName, processName, which)
    )
    return refs
  }
  walkAtoms(clause.predicate, (atom) => {
    if (atom.type === 'informal_text' && atom.text.trim()) {
      refs.push({
        key: `${moduleName}::${processName}::${which}::${atom.text.trim()}`,
        moduleName,
        processName,
        clause: which,
        text: atom.text.trim()
      })
    }
  })
  return refs
}

function typeIsDefined(type: TypeExprNode | undefined): boolean {
  if (!type) return false
  if (type.type === 'basic_type') return type.name !== 'given'
  if (type.type === 'named_type') return Boolean(type.qualified.name)
  if (type.type === 'set_type' || type.type === 'seq_type') return typeIsDefined(type.element)
  if (type.type === 'product_type') return type.elements.every(typeIsDefined)
  if (type.type === 'union_type') return Boolean(type.isUniversal) || type.variants.every(typeIsDefined)
  if (type.type === 'map_type') return typeIsDefined(type.domain) && typeIsDefined(type.range)
  if (type.type === 'composed_type') return type.fields.every((f) => typeIsDefined(f.typeExpr))
  if (type.type === 'enum_type') return type.values.length > 0
  return true
}

function processTypesDefined(proc: ProcessNode): boolean {
  const groups = [...proc.inputs, ...proc.outputs]
  if (!groups.every((g) => typeIsDefined(g.typeExpr))) return false
  return (proc.body?.ext ?? []).every((e) => !e.typeExpr || typeIsDefined(e.typeExpr))
}

function scenarioCoverageComplete(proc: ProcessNode): boolean {
  const form = deriveFsf(proc)
  if (!form) return false
  const preInformal = clauseHasInformal(proc.body?.pre)
  const postInformal = clauseHasInformal(proc.body?.post)
  if (preInformal || postInformal) return false
  if (form.source === 'editor-internal-dsl' && form.fsf) {
    const hasOthers = Boolean(form.fsf.others)
    if (!hasOthers && form.scenarios.length > 0) return false
    return isFsfFormal(form.fsf)
  }
  const post = proc.body?.post
  if (post?.kind === 'structured' && post.conditional?.elseClause) {
    return !clauseHasInformal(post)
  }
  if (form.exceptionalScenarios.length > 0 || form.scenarios.length <= 1) {
    return form.scenarios.every((s) => s.guard.trim() && s.definingCondition.trim())
  }
  return false
}

export function collectInformalAtoms(program: ProgramNode): InformalAtomRef[] {
  const refs: InformalAtomRef[] = []
  for (const mod of program.modules) {
    for (const proc of mod.processes) {
      if (proc.alias) continue
      refs.push(...informalFromClause(proc.body?.pre, mod.name, proc.name, 'pre'))
      refs.push(...informalFromClause(proc.body?.post, mod.name, proc.name, 'post'))
      if (proc.body?.fsf && !proc.body.pre && !proc.body.post) {
        walkAtoms({ type: 'predicate', span: proc.body.fsf.span, disjuncts: [] }, () => undefined)
        for (const sc of proc.body.fsf.scenarios) {
          walkAtoms(sc.test, (atom) => {
            if (atom.type === 'informal_text' && atom.text.trim()) {
              refs.push({
                key: `${mod.name}::${proc.name}::fsf::${atom.text.trim()}`,
                moduleName: mod.name,
                processName: proc.name,
                clause: 'fsf',
                text: atom.text.trim()
              })
            }
          })
          walkAtoms(sc.def, (atom) => {
            if (atom.type === 'informal_text' && atom.text.trim()) {
              refs.push({
                key: `${mod.name}::${proc.name}::fsf::${atom.text.trim()}`,
                moduleName: mod.name,
                processName: proc.name,
                clause: 'fsf',
                text: atom.text.trim()
              })
            }
          })
        }
      }
    }
  }
  return refs
}

function processIsStub(proc: ProcessNode): boolean {
  if (proc.alias) return false
  if (textOf(proc.body?.decomposition)?.trim()) return false
  if (proc.body?.pre || proc.body?.post || proc.body?.fsf) return false
  if (textOf(proc.body?.comment)?.trim()) return false
  return true
}

function moduleHasMembers(mod: ModuleNode): boolean {
  return (
    mod.consts.length > 0 ||
    mod.types.length > 0 ||
    mod.vars.length > 0 ||
    mod.invariants.length > 0 ||
    mod.processes.length > 0 ||
    mod.functions.length > 0 ||
    Boolean(mod.gui) ||
    Boolean(mod.cdfd) ||
    Boolean(mod.refine)
  )
}

function moduleHasChildren(mod: ModuleNode, program: ProgramNode): boolean {
  return program.modules.some((other) => {
    const parent = other.parent?.name
    if (!parent) return false
    return parent === mod.name || parent === `SYSTEM_${mod.name}`
  })
}

function onCdfd(mod: ModuleNode, procName: string): boolean {
  if (!mod.cdfd) return false
  return mod.cdfd.nodes.some((n) => n.name === procName)
}

export function analyzeProcessAtomicity(program: ProgramNode): ProcessAmbiguityReport {
  const processes: ProcessAtomicity[] = []
  const informalAtoms = collectInformalAtoms(program)
  const diagnostics: Diagnostic[] = []
  let incompleteScenarioCount = 0
  let openConditionCount = 0
  const unbalancedBoundaryCount = checkCdfd(program).diagnostics.filter(
    (d) => d.code === DiagnosticCodes.CDFD_BOUNDARY
  ).length
  let undeclaredAtomicCount = 0
  let stubProcessCount = 0
  const emptyModuleCount = program.modules.filter(
    (mod) => mod.name.trim().length > 0 && !moduleHasMembers(mod) && !moduleHasChildren(mod, program)
  ).length

  for (const mod of program.modules) {
    if (mod.cdfd) {
      for (const cond of mod.cdfd.conditions) {
        const outs = mod.cdfd.flows.filter((f) => f.from === cond.name)
        if (outs.length < 2 || !outs.some((f) => f.isOthers)) openConditionCount += 1
      }
    }
    for (const proc of mod.processes) {
      if (proc.alias) continue
      const decomTarget = textOf(proc.body?.decomposition)?.trim() || undefined
      const hasDecom = Boolean(decomTarget)
      const informalAtomCount = informalAtoms.filter(
        (a) => a.moduleName === mod.name && a.processName === proc.name
      ).length
      const typesDefined = processTypesDefined(proc)
      const coverage = scenarioCoverageComplete(proc)
      const onGraph = onCdfd(mod, proc.name)
      const isStub = processIsStub(proc)
      const structurallyAtomic = !hasDecom && informalAtomCount === 0 && typesDefined && coverage && onGraph && !isStub
      const row: ProcessAtomicity = {
        moduleName: mod.name,
        processName: proc.name,
        hasDecom,
        decomTarget,
        informalAtomCount,
        typesDefined,
        scenarioCoverageComplete: coverage,
        onCdfd: onGraph,
        isStub,
        structurallyAtomic
      }
      processes.push(row)
      if (!coverage) incompleteScenarioCount += 1
      if (isStub) stubProcessCount += 1
      if (structurallyAtomic) undeclaredAtomicCount += 1
    }
  }

  const informalAtomCount = informalAtoms.length
  const processAmbiguity =
    informalAtomCount +
    incompleteScenarioCount +
    openConditionCount +
    unbalancedBoundaryCount +
    undeclaredAtomicCount +
    emptyModuleCount

  return {
    processes,
    informalAtoms,
    informalAtomCount,
    incompleteScenarioCount,
    openConditionCount,
    unbalancedBoundaryCount,
    undeclaredAtomicCount,
    emptyModuleCount,
    stubProcessCount,
    processAmbiguity,
    diagnostics
  }
}

/**
 * Sign-off gate: formal leaf obligations and operational grain must both be closed.
 * Grain is not optional — a formally complete predicate can still be a compound concern.
 */
export function canDeclareAtomic(row: ProcessAtomicity, grain: { grainClosed: boolean }): boolean {
  return row.structurallyAtomic && grain.grainClosed
}
