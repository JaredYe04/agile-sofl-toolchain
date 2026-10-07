/**
 * L2 semantic check of FSF test conditions with Z3 (z3-solver, WASM).
 *
 * Follows /workspace/sofl/kb/paper-input/sofl-smt-mapping.md (team mapping spec):
 *  - mutual exclusion: for every pair i<j of non-`others` scenarios, Ctx ∧ Ti ∧ Tj must be UNSAT
 *    (the `others` branch is exclusive by definition and is not checked);
 *  - completeness: Ctx ∧ ¬(T1 ∨ … ∨ Tn) must be UNSAT; an `others` branch makes it trivially
 *    true (info ASFL_FSF_209, no solver call);
 *  - only test conditions T are encoded, never D.
 * Ctx = type axioms (nat0 ≥ 0, nat ≥ 1, enum domain), module constants with literal values.
 * Invariants are NOT assumed (mapping §1.4 [assumption], no switch implemented yet).
 * `~x` is a separate constant `x__old` with the same type/axioms (old state, G:538).
 *
 * Result policy (mapping §4/§5): SAT → error 201/202 with counterexample; unknown → warning 203;
 * timeout → warning 204; unsupported construct → warning 205; natural-language atom → warning 206
 * (never an error); L1 failed / skipped → warning 207; solver unavailable → warning 208.
 * Unsupported atoms are never silently replaced by true/false.
 *
 * Documented choices for [assumption] items in the mapping:
 *  - enums are encoded as Int with a 0..k-1 domain axiom (equivalent to a datatype);
 *  - `div`/`mod` use Z3 Int div/mod (Euclidean); `rem` = a - b*(a div b) is not encoded (205);
 *  - `**` only for literal exponents 0..4; `/` is Real division;
 *  - composite/product/union/given/char types, quantifiers, comprehensions, `rng`, `nil`,
 *    user function calls → unsupported (205);
 *  - seq indexing s(i) is 1-based → nth(i-1); `hd(s)` → nth(0) with no side condition;
 *  - `e inset elems(s)` → SeqContains(s, unit(e)); `e inset dom(m)` → membership in m's domain set;
 *  - card(S) → uninterpreted function with card(S) ≥ 0.
 *  - per-check timeout 2000 ms (default), per-FSF budget 10 s; n > 20 scenarios → only adjacent pairs.
 */
import type {
  ProgramNode, ModuleNode, ProcessNode, PredicateNode, AtomicPredicateNode, ExpressionNode, TypeExprNode
} from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import type { Span } from '../ast/span.js'
import { createDiagnostic, DiagnosticCodes, type Diagnostic } from '../diagnostics/codes.js'
import { checkProcessFsfL1 } from './l1Check.js'

type S =
  | { k: 'int'; min?: number }
  | { k: 'real' }
  | { k: 'bool' }
  | { k: 'string' }
  | { k: 'enum'; values: string[] }
  | { k: 'set'; el: S }
  | { k: 'seq'; el: S }
  | { k: 'map'; d: S; r: S }

class Unsupported extends Error {
  constructor(public construct: string, public span?: Span) { super(construct) }
}
class Informal extends Error {
  constructor(public span: Span) { super('informal') }
}

export type SolveStatus = 'sat' | 'unsat' | 'unknown'
export interface SolveResult { status: SolveStatus; reason?: string; model?: string }
export interface L2Options {
  /** per solver call (default 2000 ms) */
  timeoutMs?: number
  /** total budget per FSF (default 10000 ms) */
  fsfBudgetMs?: number
  /** test hook: replace the solver call (e.g. force unknown/timeout) */
  solve?: (kind: 'exclusion' | 'completeness', run: () => Promise<SolveResult>) => Promise<SolveResult>
  /** coverage collector: one entry per process with an FSF is pushed here (see scripts/l2-coverage.mjs) */
  stats?: L2ProcessStats[]
}

export type L2Outcome = 'sat' | 'unsat' | 'unknown' | 'timeout' | 'skipped'
export interface L2ProcessStats {
  module: string
  process: string
  scenarios: number
  hasOthers: boolean
  /** bottom-level process: no `decom:` clause */
  leaf: boolean
  decomposition?: string
  /** 'l1-failed' | 'others-only' | 'no-solver' when L2 did not run at all */
  skippedWhole?: string
  /** per non-others test condition: encoded, or why not */
  tests: Array<{ index: number; status: 'encoded' | 'informal' | 'unsupported' | 'error'; reason?: string; span?: Span; testSpan?: Span }>
  exclusion: Array<{ i: number; j: number; outcome: L2Outcome; skipReasons?: string[] }>
  /** 'others' = complete by construction; 'n/a' when not applicable */
  completeness: { outcome: L2Outcome | 'others'; skipReasons?: string[] }
}

// ---------- Z3 singleton ----------
let z3Promise: Promise<any> | null = null
async function getZ3(): Promise<any | null> {
  if (!z3Promise) {
    z3Promise = (async () => {
      try {
        const mod: any = await import('z3-solver')
        const { Context } = await (mod.init ?? mod.default?.init)()
        return Context('agile-sofl-l2')
      } catch {
        return null
      }
    })()
  }
  return z3Promise
}

// ---------- environment ----------
interface Env {
  modules: Map<string, ModuleNode>
  types: Map<string, TypeExprNode>
  consts: Map<string, ExpressionNode>
  vars: Map<string, TypeExprNode>
  enumOf: Map<string, string[]>
}

function buildEnv(program: ProgramNode, module: ModuleNode, proc: ProcessNode): Env {
  const env: Env = { modules: new Map(), types: new Map(), consts: new Map(), vars: new Map(), enumOf: new Map() }
  for (const m of program.modules) env.modules.set(m.name, m)
  // ancestors first so that inner declarations shadow outer ones
  const chain: ModuleNode[] = []
  let cur: ModuleNode | undefined = module
  const seen = new Set<string>()
  while (cur && !seen.has(cur.name)) {
    seen.add(cur.name)
    chain.unshift(cur)
    const pn: string | undefined = cur.parent?.name
    cur = pn ? (env.modules.get(pn) ?? program.modules.find((m) => m.isSystem && `SYSTEM_${m.name}` === pn)) : undefined
  }
  for (const m of chain) {
    for (const t of m.types) env.types.set(t.name, t.typeExpr)
    for (const c of m.consts) env.consts.set(c.name, c.value)
    for (const v of m.vars) env.vars.set(v.variable.name, v.typeExpr)
  }
  for (const [, t] of env.types) if (t.type === 'enum_type') for (const v of t.values) env.enumOf.set(stripEnum(v), t.values.map(stripEnum))
  for (const e of proc.body?.ext ?? []) if (e.typeExpr) env.vars.set(e.name, e.typeExpr)
  for (const g of proc.inputs) for (const n of g.names) env.vars.set(n, g.typeExpr)
  for (const g of proc.outputs) for (const n of g.names) env.vars.set(n, g.typeExpr)
  // inline enumerations, e.g. `kind: {<ByCourse>, <ByDate>}` in a parameter list
  const walkT = (t: unknown): void => {
    if (Array.isArray(t)) { t.forEach(walkT); return }
    if (!t || typeof t !== 'object') return
    const n = t as Record<string, any>
    if (n.type === 'enum_type') for (const v of n.values) if (!env.enumOf.has(stripEnum(v))) env.enumOf.set(stripEnum(v), n.values.map(stripEnum))
    for (const [k, v] of Object.entries(n)) if (k !== 'span') walkT(v)
  }
  walkT([...env.vars.values()])
  return env
}

const stripEnum = (v: string) => v.replace(/^<|>$/g, '')

function sortOf(t: TypeExprNode, env: Env, depth = 0): S {
  if (depth > 20) throw new Unsupported('recursive type', t.span)
  switch (t.type) {
    case 'basic_type':
      if (t.name === 'nat0') return { k: 'int', min: 0 }
      if (t.name === 'nat') return { k: 'int', min: 1 }
      if (t.name === 'int') return { k: 'int' }
      if (t.name === 'real') return { k: 'real' }
      if (t.name === 'bool') return { k: 'bool' }
      if (t.name === 'string') return { k: 'string' }
      throw new Unsupported(`type ${t.name}`, t.span)
    case 'named_type': {
      const d = env.types.get(t.qualified.name)
      if (!d) throw new Unsupported(`type ${t.qualified.name}`, t.span)
      return sortOf(d, env, depth + 1)
    }
    case 'enum_type': return { k: 'enum', values: t.values.map(stripEnum) }
    case 'set_type': return { k: 'set', el: sortOf(t.element, env, depth + 1) }
    case 'seq_type': return { k: 'seq', el: sortOf(t.element, env, depth + 1) }
    case 'map_type': return { k: 'map', d: sortOf(t.domain, env, depth + 1), r: sortOf(t.range, env, depth + 1) }
    default: throw new Unsupported(t.type.replace('_type', ' type'), t.span)
  }
}

// ---------- encoder ----------
interface V { e: any; s: S }
class Encoder {
  axioms: any[] = []
  declared = new Map<string, { v: V; display: string }>()
  constructor(private Z: any, private env: Env) {}

  z(s: S): any {
    const Z = this.Z
    switch (s.k) {
      case 'int': case 'enum': return Z.Int.sort()
      case 'real': return Z.Real.sort()
      case 'bool': return Z.Bool.sort()
      case 'string': return Z.String.sort()
      case 'set': return Z.Set.sort(this.z(s.el))
      case 'seq': return Z.Seq.sort(this.z(s.el))
      case 'map': throw new Unsupported('nested map')
    }
  }

  private axiomFor(e: any, s: S): void {
    const Z = this.Z
    if (s.k === 'int' && s.min !== undefined) this.axioms.push(e.ge(s.min))
    if (s.k === 'enum') this.axioms.push(Z.And(e.ge(0), e.lt(s.values.length)))
  }

  variable(name: string, old: boolean, span: Span): V {
    const key = old ? `${name}__old` : name
    const hit = this.declared.get(key)
    if (hit) return hit.v
    const c = this.env.consts.get(name)
    if (c && !old) return this.expr(c)
    const t = this.env.vars.get(name)
    if (!t) throw new Unsupported(`undeclared identifier '${name}'`, span)
    const s = sortOf(t, this.env)
    const Z = this.Z
    let e: any
    if (s.k === 'map') {
      e = { dom: Z.Set.const(`${key}__dom`, this.z(s.d)), app: Z.Array.const(`${key}__app`, this.z(s.d), this.z(s.r)) }
    } else if (s.k === 'set') {
      e = Z.Set.const(key, this.z(s.el))
    } else {
      e = Z.Const(key, this.z(s))
      this.axiomFor(e, s)
    }
    const v = { e, s }
    this.declared.set(key, { v, display: old ? `~${name}` : name })
    return v
  }

  num(v: V, span: Span): V {
    if (v.s.k !== 'int' && v.s.k !== 'real') throw new Unsupported('non-numeric operand', span)
    return v
  }

  arith(a: V, b: V): [any, any, S] {
    if (a.s.k === 'real' || b.s.k === 'real') {
      const Z = this.Z
      const ra = a.s.k === 'int' ? Z.ToReal(a.e) : a.e
      const rb = b.s.k === 'int' ? Z.ToReal(b.e) : b.e
      return [ra, rb, { k: 'real' }]
    }
    return [a.e, b.e, { k: 'int' }]
  }

  expr(x: ExpressionNode): V {
    const Z = this.Z
    switch (x.type) {
      case 'number_literal':
        return x.isReal ? { e: Z.Real.val(x.value), s: { k: 'real' } } : { e: Z.Int.val(x.value), s: { k: 'int' } }
      case 'boolean_literal': return { e: Z.Bool.val(x.value), s: { k: 'bool' } }
      case 'string_literal': return { e: Z.String.val(x.value), s: { k: 'string' } }
      case 'seq_expr':
        if (x.kind === 'string') return { e: Z.String.val(x.stringValue ?? ''), s: { k: 'string' } }
        if (x.kind === 'list' && x.elements?.length) {
          const els = x.elements.map((el) => this.expr(el))
          const units = els.map((el) => Z.Seq.unit(el.e))
          return { e: units.reduce((a: any, b: any) => a.concat(b)), s: { k: 'seq', el: els[0]!.s } }
        }
        throw new Unsupported(`sequence ${x.kind}`, x.span)
      case 'set_expr':
        if (x.kind === 'list' && x.elements?.length) {
          const els = x.elements.map((el) => this.expr(el))
          let set = Z.Set.empty(this.z(els[0]!.s))
          for (const el of els) set = set.add(el.e)
          return { e: set, s: { k: 'set', el: els[0]!.s } }
        }
        throw new Unsupported(`set ${x.kind}`, x.span)
      case 'enum_literal': {
        const v = stripEnum(x.value)
        const values = this.env.enumOf.get(v)
        if (!values) throw new Unsupported(`enum value <${v}>`, x.span)
        return { e: Z.Int.val(values.indexOf(v)), s: { k: 'enum', values } }
      }
      case 'identifier': return this.variable(x.name, x.oldState === true, x.span)
      case 'paren_expr': return this.expr((x as any).inner)
      case 'unary_minus': {
        const v = this.num(this.expr(x.operand), x.span)
        return { e: v.e.neg(), s: v.s.k === 'real' ? v.s : { k: 'int' } }
      }
      case 'binary_op': {
        const a = this.num(this.expr(x.left), x.span)
        const b = this.num(this.expr(x.right), x.span)
        if (x.op === '**') {
          if (x.right.type !== 'number_literal' || x.right.value < 0 || x.right.value > 4 || x.right.isReal) throw new Unsupported('** with non-literal exponent', x.span)
          let r = x.right.value === 0 ? (a.s.k === 'real' ? Z.Real.val(1) : Z.Int.val(1)) : a.e
          for (let i = 1; i < x.right.value; i++) r = r.mul(a.e)
          return { e: r, s: a.s.k === 'real' ? a.s : { k: 'int' } }
        }
        if (x.op === 'div' || x.op === 'mod') {
          if (a.s.k !== 'int' || b.s.k !== 'int') throw new Unsupported(`${x.op} on reals`, x.span)
          return { e: x.op === 'div' ? a.e.div(b.e) : a.e.mod(b.e), s: { k: 'int' } }
        }
        if (x.op === 'rem') throw new Unsupported('rem', x.span)
        if (x.op === '/') {
          const ra = a.s.k === 'int' ? Z.ToReal(a.e) : a.e
          const rb = b.s.k === 'int' ? Z.ToReal(b.e) : b.e
          return { e: ra.div(rb), s: { k: 'real' } }
        }
        const [l, r, s] = this.arith(a, b)
        return { e: x.op === '+' ? l.add(r) : x.op === '-' ? l.sub(r) : l.mul(r), s }
      }
      case 'call': return this.call(x)
      case 'relational_expr': return { e: this.relational(x), s: { k: 'bool' } }
      default:
        throw new Unsupported(x.type.replace(/_/g, ' '), x.span)
    }
  }

  call(x: Extract<ExpressionNode, { type: 'call' }>): V {
    const Z = this.Z
    if (typeof x.callee !== 'string') {
      // application of a map / sequence variable: m(k), s(i), ~m(k)
      const target = this.expr(x.callee)
      if (x.args.length !== 1) throw new Unsupported('application', x.span)
      const arg = this.expr(x.args[0]!)
      if (target.s.k === 'map') return { e: target.e.app.select(arg.e), s: target.s.r }
      if (target.s.k === 'seq') return { e: target.e.nth(arg.e.sub(1)), s: target.s.el }
      throw new Unsupported('function application', x.span)
    }
    const name = x.callee
    const args = () => x.args.map((a) => this.expr(a))
    switch (name) {
      case 'len': { const [s] = args(); if (s!.s.k !== 'seq' && s!.s.k !== 'string') throw new Unsupported('len of non-sequence', x.span); return { e: s!.e.length(), s: { k: 'int', min: 0 } } }
      case 'abs': { const [v] = args(); this.num(v!, x.span); return { e: Z.If(v!.e.ge(0), v!.e, v!.e.neg()), s: v!.s } }
      case 'floor': { const [v] = args(); this.num(v!, x.span); return { e: v!.s.k === 'real' ? Z.ToInt(v!.e) : v!.e, s: { k: 'int' } } }
      case 'hd': { const [s] = args(); if (s!.s.k !== 'seq') throw new Unsupported('hd of non-sequence', x.span); return { e: s!.e.nth(0), s: s!.s.el } }
      case 'tl': { const [s] = args(); if (s!.s.k !== 'seq') throw new Unsupported('tl of non-sequence', x.span); return { e: s!.e.extract(1, s!.e.length().sub(1)), s: s!.s } }
      case 'conc': { const [a, b] = args(); if (a!.s.k !== 'seq') throw new Unsupported('conc', x.span); return { e: a!.e.concat(b!.e), s: a!.s } }
      case 'dom': { const [m] = args(); if (m!.s.k !== 'map') throw new Unsupported('dom of non-map', x.span); return { e: m!.e.dom, s: { k: 'set', el: m!.s.d } } }
      case 'union': case 'inter': case 'diff': {
        const [a, b] = args()
        if (a!.s.k !== 'set') throw new Unsupported(name, x.span)
        return { e: name === 'union' ? a!.e.union(b!.e) : name === 'inter' ? a!.e.intersect(b!.e) : a!.e.diff(b!.e), s: a!.s }
      }
      case 'card': {
        const [a] = args()
        if (a!.s.k !== 'set') throw new Unsupported('card of non-set', x.span)
        const f = Z.Function.declare(`card__${JSON.stringify(a!.s).replace(/\W/g, '')}`, this.z(a!.s), Z.Int.sort())
        const r = f.call(a!.e)
        this.axioms.push(r.ge(0))
        return { e: r, s: { k: 'int', min: 0 } }
      }
      case 'subset': case 'psubset': {
        const [a, b] = args()
        if (a!.s.k !== 'set') throw new Unsupported(name, x.span)
        const sub = a!.e.subsetOf(b!.e)
        return { e: name === 'subset' ? sub : Z.And(sub, Z.Not(a!.e.eq(b!.e))), s: { k: 'bool' } }
      }
      default:
        throw new Unsupported(`${name}(…)`, x.span)
    }
  }

  compare(kind: 'lt' | 'le' | 'gt' | 'ge', a: V, b: V, span: Span): any {
    this.num(a, span); this.num(b, span)
    const [l, r] = this.arith(a, b)
    return kind === 'lt' ? l.lt(r) : kind === 'le' ? l.le(r) : kind === 'gt' ? l.gt(r) : l.ge(r)
  }

  membership(x: Extract<ExpressionNode, { type: 'relational_expr' }>): any {
    const Z = this.Z
    const el = this.expr(x.left)
    const right = x.right
    let r: any
    if (right.type === 'call' && right.callee === 'elems' && right.args.length === 1) {
      const s = this.expr(right.args[0]!)
      if (s.s.k !== 'seq') throw new Unsupported('elems of non-sequence', right.span)
      r = s.e.contains(Z.Seq.unit(el.e))
    } else if (right.type === 'call' && right.callee === 'inds' && right.args.length === 1) {
      const s = this.expr(right.args[0]!)
      r = Z.And(el.e.ge(1), el.e.le(s.e.length()))
    } else {
      const set = this.expr(right)
      if (set.s.k !== 'set') throw new Unsupported('membership in non-set', right.span)
      r = set.e.contains(el.e)
    }
    return x.kind === 'notin' ? Z.Not(r) : r
  }

  relational(x: Extract<ExpressionNode, { type: 'relational_expr' }>): any {
    const Z = this.Z
    if (x.kind === 'inset' || x.kind === 'notin') return this.membership(x)
    if ((x.kind === 'chain_lt' || x.kind === 'chain_gt') && x.chainOps && x.chainHigh) {
      const a = this.expr(x.left), b = this.expr(x.right), c = this.expr(x.chainHigh)
      return Z.And(this.compare(x.chainOps[0], a, b, x.span), this.compare(x.chainOps[1], b, c, x.span))
    }
    const a = this.expr(x.left), b = this.expr(x.right)
    if (x.kind === 'eq' || x.kind === 'neq') {
      let eq: any
      if (a.s.k === 'map' || b.s.k === 'map') throw new Unsupported('map equality', x.span)
      if ((a.s.k === 'int' || a.s.k === 'real' || a.s.k === 'enum') && (b.s.k === 'int' || b.s.k === 'real' || b.s.k === 'enum')) {
        const [l, r] = a.s.k === 'enum' || b.s.k === 'enum' ? [a.e, b.e] : this.arith(a, b)
        eq = l.eq(r)
      } else if (a.s.k === b.s.k) eq = a.e.eq(b.e)
      else throw new Unsupported(`comparison of ${a.s.k} with ${b.s.k}`, x.span)
      return x.kind === 'eq' ? eq : Z.Not(eq)
    }
    return this.compare(x.kind as 'lt', a, b, x.span)
  }

  atom(a: AtomicPredicateNode): any {
    const Z = this.Z
    switch (a.type) {
      case 'informal_text': throw new Informal(a.span)
      case 'boolean_literal': return Z.Bool.val(a.value)
      case 'not_predicate': return Z.Not(this.atom(a.operand))
      case 'paren_predicate': return this.atom(a.inner)
      case 'quantified': throw new Unsupported(a.quantifier === 'forall' ? 'forall' : 'exists', a.span)
      case 'relational_expr': return this.relational(a)
      default: {
        const v = this.expr(a as ExpressionNode)
        if (v.s.k !== 'bool') throw new Unsupported('non-boolean atom', (a as any).span)
        return v.e
      }
    }
  }

  predicate(p: PredicateNode): any {
    const Z = this.Z
    const ds = p.disjuncts.map((c) => {
      const as = c.atoms.map((a) => this.atom(a))
      return as.length === 1 ? as[0] : Z.And(...as)
    })
    return ds.length === 1 ? ds[0] : Z.Or(...ds)
  }

  renderModel(model: any): string {
    const parts: string[] = []
    for (const [, { v, display }] of [...this.declared.entries()].sort((a, b) => a[1].display.localeCompare(b[1].display))) {
      try {
        if (v.s.k === 'map') continue
        const val = model.eval(v.e, true)
        let txt = val.toString()
        if (v.s.k === 'enum') txt = `<${v.s.values[Number(txt)] ?? txt}>`
        else if (v.s.k === 'real' && typeof val.asDecimal === 'function') txt = val.asDecimal(6)?.replace(/\?$/, '') ?? txt
        txt = txt.replace(/^\(- (\d+)\)$/, '-$1')
        parts.push(`${display} = ${txt}`)
      } catch { /* skip */ }
    }
    return parts.join(', ')
  }
}

// ---------- checks ----------
export async function checkProcessFsfL2(
  program: ProgramNode, module: ModuleNode, proc: ProcessNode, opts: L2Options = {}
): Promise<Diagnostic[]> {
  const fsf = proc.body?.fsf
  if (!fsf) return []
  const out: Diagnostic[] = []
  const p = proc.name
  const n = fsf.scenarios.length
  const decom = textOf(proc.body?.decomposition)?.trim() || undefined
  const st: L2ProcessStats = { module: module.name, process: p, scenarios: n, hasOthers: !!fsf.others, leaf: !decom, decomposition: decom, tests: [], exclusion: [],
    completeness: { outcome: fsf.others ? 'others' : 'skipped' } }
  opts.stats?.push(st)
  if (n === 0) { st.skippedWhole = 'others-only'; return [] } // only `others`: trivially exclusive and complete
  if (checkProcessFsfL1(proc).some((d) => d.severity === 'error')) {
    st.skippedWhole = 'l1-failed'
    return [createDiagnostic(DiagnosticCodes.FSF_L2_SKIPPED, `L2 check for '${p}' skipped: L1 failed`, 'warning', fsf.span)]
  }
  const needsSolver = n >= 2 || !fsf.others
  if (fsf.others) {
    out.push(createDiagnostic(DiagnosticCodes.FSF_L2_COMPLETE_BY_OTHERS, `FSF of '${p}' is complete by its 'others' branch.`, 'info', fsf.others.span))
  }
  if (!needsSolver) return out
  const Z = await getZ3()
  if (!Z) {
    st.skippedWhole = 'no-solver'
    out.push(createDiagnostic(DiagnosticCodes.FSF_L2_SOLVER_UNAVAILABLE, 'Z3 solver unavailable; L2 checks disabled.', 'warning', fsf.span))
    return out
  }
  const env = buildEnv(program, module, proc)
  const enc = new Encoder(Z, env)
  const T: Array<any | null> = []
  fsf.scenarios.forEach((sc, i) => {
    try {
      T.push(enc.predicate(sc.test))
      st.tests.push({ index: i + 1, status: 'encoded', testSpan: sc.test.span })
    } catch (e) {
      T.push(null)
      st.tests.push(e instanceof Informal ? { index: i + 1, status: 'informal', reason: 'natural-language atom', span: e.span, testSpan: sc.test.span }
        : e instanceof Unsupported ? { index: i + 1, status: 'unsupported', reason: e.construct }
          : { index: i + 1, status: 'error', reason: String((e as Error)?.message ?? e) })
      if (e instanceof Informal) {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L2_INFORMAL,
          `mutual exclusion / completeness checks for '${p}' involving test condition ${i + 1} skipped: test condition ${i + 1} contains informal text.`, 'warning', e.span))
      } else if (e instanceof Unsupported) {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L2_UNSUPPORTED,
          `mutual exclusion / completeness checks for '${p}' involving test condition ${i + 1} skipped: '${e.construct}' is not supported by the L2 checker.`, 'warning', e.span ?? sc.test.span))
      } else {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L2_UNSUPPORTED,
          `L2 encoding of test condition ${i + 1} of '${p}' failed: ${String((e as Error)?.message ?? e)}`, 'warning', sc.test.span))
      }
    }
  })
  const timeout = opts.timeoutMs ?? 2000
  const budgetEnd = Date.now() + (opts.fsfBudgetMs ?? 10000)
  const run = async (formula: any): Promise<SolveResult> => {
    const solver = new Z.Solver()
    solver.set('timeout', timeout)
    for (const a of enc.axioms) solver.add(a)
    solver.add(formula)
    const status: SolveStatus = await solver.check()
    if (status === 'sat') return { status, model: enc.renderModel(solver.model()) }
    if (status === 'unknown') return { status, reason: String(solver.reasonUnknown?.() ?? 'unknown') }
    return { status }
  }
  const solve = (kind: 'exclusion' | 'completeness', f: any) =>
    opts.solve ? opts.solve(kind, () => run(f)) : run(f)
  const reasonsOf = (idx: number[]) => idx.filter((k) => !T[k]).map((k) => st.tests[k]!.reason ?? st.tests[k]!.status)
  const outcomeOf = (r: SolveResult): L2Outcome => r.status === 'unknown' ? (/timeout|canceled/i.test(r.reason ?? '') ? 'timeout' : 'unknown') : r.status
  const unknownDiag = (check: string, r: SolveResult) => /timeout|canceled/i.test(r.reason ?? '')
    ? createDiagnostic(DiagnosticCodes.FSF_L2_TIMEOUT, `${check} check for '${p}' timed out after ${timeout} ms.`, 'warning', fsf.span)
    : createDiagnostic(DiagnosticCodes.FSF_L2_UNKNOWN, `Could not decide ${check} for '${p}' (solver returned unknown: ${r.reason ?? 'unknown'}).`, 'warning', fsf.span)

  const pairs: Array<[number, number]> = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (n <= 20 || j === i + 1) pairs.push([i, j])
  for (const [i, j] of pairs) {
    if (!T[i] || !T[j]) { st.exclusion.push({ i: i + 1, j: j + 1, outcome: 'skipped', skipReasons: reasonsOf([i, j]) }); continue }
    const check = `mutual exclusion (scenarios ${i + 1},${j + 1})`
    if (Date.now() > budgetEnd) { st.exclusion.push({ i: i + 1, j: j + 1, outcome: 'timeout' }); out.push(createDiagnostic(DiagnosticCodes.FSF_L2_TIMEOUT, `${check} check for '${p}' timed out (FSF budget exhausted).`, 'warning', fsf.span)); continue }
    const r = await solve('exclusion', Z.And(T[i], T[j]))
    st.exclusion.push({ i: i + 1, j: j + 1, outcome: outcomeOf(r) })
    if (r.status === 'sat') {
      out.push(createDiagnostic(DiagnosticCodes.FSF_L2_OVERLAP,
        `FSF scenarios ${i + 1} and ${j + 1} of '${p}' are not mutually exclusive. Counterexample: ${r.model || '(any)'}`, 'error', fsf.scenarios[j]!.test.span))
    } else if (r.status === 'unknown') out.push(unknownDiag(check, r))
  }
  if (!fsf.others && !T.every((t) => t)) st.completeness = { outcome: 'skipped', skipReasons: reasonsOf(T.map((_, k) => k)) }
  if (!fsf.others && T.every((t) => t)) {
    if (Date.now() > budgetEnd) {
      st.completeness = { outcome: 'timeout' }
      out.push(createDiagnostic(DiagnosticCodes.FSF_L2_TIMEOUT, `completeness check for '${p}' timed out (FSF budget exhausted).`, 'warning', fsf.span))
    } else {
      const r = await solve('completeness', Z.Not(T.length === 1 ? T[0] : Z.Or(...T)))
      st.completeness = { outcome: outcomeOf(r) }
      if (r.status === 'sat') {
        out.push(createDiagnostic(DiagnosticCodes.FSF_L2_INCOMPLETE,
          `FSF of '${p}' is incomplete: no test condition holds for ${r.model || '(some input)'}. Add a scenario or an 'others' branch.`, 'error', fsf.span))
      } else if (r.status === 'unknown') out.push(unknownDiag('completeness', r))
    }
  }
  return out
}

export async function checkFsfL2(program: ProgramNode, opts: L2Options = {}): Promise<{ diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = []
  for (const m of program.modules) {
    for (const proc of m.processes ?? []) diagnostics.push(...(await checkProcessFsfL2(program, m, proc, opts)))
  }
  return { diagnostics }
}
