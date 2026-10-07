/**
 * L1 static check of FSF scenarios (final grammar §FSF, G:183-194):
 *  - a test condition T must not contain output variables;
 *  - a defining condition D must contain at least one output variable.
 *
 * Variable roles:
 *  - output: process output parameters, and wr external variables written without `~`
 *    (their final value);
 *  - `~x` (old state, IdentifierNode.oldState) is allowed in T;
 *  - in D, any rd/wr external variable written with `~` also counts as "having output"
 *    (team decision, see report);
 *  - a plain (non-`~`) wr external variable in T is reported as a warning (ASFL_FSF_104)
 *    since it denotes the final value; write `~x` for the initial value.
 *  - the `others && D` branch has no T, so only D is checked.
 *  - natural-language atoms (InformalTextNode) make the corresponding check undecidable:
 *    it is skipped with a warning (ASFL_FSF_103), never an error.
 *  - quantifier / let binding names are local and ignored.
 */
import type { ProgramNode, ProcessNode, PredicateNode } from '../ast/nodes.js'
import type { Span } from '../ast/span.js'
import { createDiagnostic, DiagnosticCodes, type Diagnostic } from '../diagnostics/codes.js'

interface Ref { name: string; old: boolean; span: Span }

interface Scan { refs: Ref[]; informal: boolean }

function scanPredicate(pred: PredicateNode): Scan {
  const refs: Ref[] = []
  let informal = false
  const visit = (node: unknown, bound: Set<string>): void => {
    if (Array.isArray(node)) { node.forEach((n) => visit(n, bound)); return }
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, any>
    if (n.type === 'informal_text') { informal = true; return }
    if (n.type === 'identifier') {
      if (!bound.has(n.name)) refs.push({ name: n.name, old: n.oldState === true, span: n.span })
      return
    }
    let inner = bound
    if (n.type === 'quantified' || n.type === 'let_expr' || n.type === 'set_expr' || n.type === 'seq_expr' || n.type === 'map_expr') {
      const names: string[] = []
      for (const b of n.bindings ?? []) names.push(...(b.names ?? []), ...(b.name ? [b.name] : []))
      if (names.length) inner = new Set([...bound, ...names])
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === 'span' || k === 'nameSpan') continue
      visit(v, inner)
    }
  }
  visit(pred, new Set())
  return { refs, informal }
}

export function checkProcessFsfL1(process: ProcessNode): Diagnostic[] {
  const fsf = process.body?.fsf
  if (!fsf) return []
  const out: Diagnostic[] = []
  const outputs = new Set(process.outputs.flatMap((g) => g.names))
  const ext = process.body?.ext ?? []
  const wr = new Set(ext.filter((e) => e.access === 'wr').map((e) => e.name))
  const extAll = new Set(ext.map((e) => e.name))
  const p = process.name

  const checkOldState = (s: Scan, where: string) => {
    for (const r of s.refs) {
      if (r.old && !extAll.has(r.name)) {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L1_OLD_STATE_NON_EXT,
          `${where} of '${p}' applies '~' to '${r.name}', which is not an external (ext) variable; only ext/state variables have an initial value`, 'error', r.span))
      }
    }
  }
  const checkDef = (def: PredicateNode, label: string) => {
    const s = scanPredicate(def)
    checkOldState(s, `Defining condition ${label}`)
    // only the final value of an output / wr external variable is constrained by D; `~x` (initial value) is not
    const has = s.refs.some((r) => !r.old && (outputs.has(r.name) || wr.has(r.name)))
    if (has) return
    if (s.informal) {
      out.push(createDiagnostic(DiagnosticCodes.FSF_L1_INFORMAL_SKIPPED,
        `L1 check of defining condition ${label} of '${p}' skipped: it contains natural-language text`, 'warning', def.span))
      return
    }
    if (outputs.size === 0 && wr.size === 0) return // nothing could be constrained
    out.push(createDiagnostic(DiagnosticCodes.FSF_L1_NO_OUTPUT_IN_DEF,
      `Defining condition ${label} of '${p}' does not constrain any output variable` +
      ` (${[...outputs, ...wr].join(', ')})`, 'error', def.span))
  }

  fsf.scenarios.forEach((sc, idx) => {
    const label = `D${idx + 1}`
    const t = scanPredicate(sc.test)
    checkOldState(t, `Test condition T${idx + 1}`)
    for (const r of t.refs) {
      if (r.old) continue
      if (outputs.has(r.name)) {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L1_OUTPUT_IN_TEST,
          `Test condition T${idx + 1} of '${p}' must not contain output variable '${r.name}'`, 'error', r.span))
      } else if (wr.has(r.name)) {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L1_WR_IN_TEST,
          `Test condition T${idx + 1} of '${p}' refers to wr external variable '${r.name}' (final value); use '~${r.name}' for its initial value`,
          'warning', r.span))
      }
    }
    if (t.informal) {
      out.push(createDiagnostic(DiagnosticCodes.FSF_L1_INFORMAL_SKIPPED,
        `L1 check of test condition T${idx + 1} of '${p}' is partial: natural-language text cannot be checked for output variables`,
        'warning', sc.test.span))
    }
    checkDef(sc.def, label)
  })
  if (fsf.others) checkDef(fsf.others, 'of the others branch')
  return out
}

export function checkFsfL1(program: ProgramNode): { diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  for (const m of program.modules) {
    for (const proc of m.processes ?? []) diagnostics.push(...checkProcessFsfL1(proc))
  }
  return { diagnostics }
}
