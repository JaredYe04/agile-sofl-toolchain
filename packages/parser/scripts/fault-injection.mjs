#!/usr/bin/env node
/**
 * RQ3 fault-injection experiment for the FSF checks (no LLM).
 * Rules: sofl/kb/paper-input/fault-injection-rules.md (v0.1).
 *
 *   npm run build && node scripts/fault-injection.mjs [--seed 20261008] [--max 15] [--out <dir>]
 *
 * Scope: bottom-level (no `decom:`) processes of the two reference specs.
 * Mutations are located on the AST (process / scenario / identifier spans) and applied as
 * source edits at those spans, so every mutant is a full re-parsed .asfl spec.
 * Derived processes (class A/B substrate): every single-scenario bottom process with a numeric
 * input variable x is split on a boundary of x into
 *   _d2: x <= K && D1 || x > K && D2                          (exclusive + complete, no others)
 *   _d3: x < K && D1 || x >= K and x <= K2 && D2 || x > K2 && D2   (3 scenarios, no others)
 *   _dg: x < K && D1 || x > K && D2 || others && D2           (gap at K, covered by others)
 *   _dc: x <= K && D1 || x > K && D2 || others && D2          (others redundant)
 * D1 = original scenario D, D2 = original `others` D (or D1 when absent). K = 10, K2 = 20.
 * Derived processes must pass parser + L1 + L2 with 0 errors (checked; failing ones are dropped).
 * Ground truth for class A/B (exclusion / completeness actually violated?) is computed by
 * brute-force enumeration of x over its domain (independent of Z3); a mutant whose property
 * still holds is an "equivalent mutant".
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { check, printType } from '../dist/index.js'
import { checkFsfL2 } from '../dist/fsf/l2Check.js'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const SEED = Number(opt('--seed', 20261008))
const MAX = Number(opt('--max', 15))
const day = new Date().toLocaleDateString('sv-SE')
const OUT = opt('--out', join(here, '../../../experiments/fault-injection', day))
const SPECS = ['classroom-reference.asfl', 'delivery-reference.asfl'].map((f) => join(here, '../tests/fixtures/reference-systems', f))
const K = 10, K2 = 20

// ---------- deterministic RNG ----------
let rs = SEED >>> 0
const rand = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 2 ** 32 }
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

// ---------- helpers ----------
const layerOf = (code) => /^ASFL_FSF_1\d\d$/.test(code) ? 'L1' : /^ASFL_FSF_2\d\d$/.test(code) ? 'L2' : 'parser'
const walkAll = (n, f, seen = new Set()) => {
  if (!n || typeof n !== 'object' || seen.has(n)) return
  seen.add(n); f(n)
  for (const [k, v] of Object.entries(n)) if (k !== 'span' && k !== 'parent') Array.isArray(v) ? v.forEach((x) => walkAll(x, f, seen)) : walkAll(v, f, seen)
}
const idents = (node) => { const out = []; walkAll(node, (x) => { if (x.type === 'identifier' && x.span) out.push(x) }); return out.sort((a, b) => a.span.start - b.span.start) }

async function analyse(src) {
  const r = check(src)
  const diags = [...r.diagnostics]
  const stats = []
  if (r.ast) diags.push(...(await checkFsfL2(r.ast, { stats })).diagnostics)
  const procs = []
  if (r.ast) for (const m of r.ast.modules) for (const p of m.processes ?? []) procs.push({ module: m.name, name: p.name, span: p.span })
  const procAt = (off) => procs.find((p) => off >= p.span.start && off <= p.span.end)?.name ?? '(none)'
  const parseOk = !r.diagnostics.some((d) => /PARSE|SYNTAX|LEX/i.test(d.code) && d.severity === 'error') && !!r.ast
  return { ast: r.ast, parseOk, stats, diags: diags.map((d) => ({ code: d.code, layer: layerOf(d.code), severity: d.severity, process: procAt(d.span?.start ?? -1), line: d.span?.line, message: d.message })) }
}

function typeEnv(ast) {
  const decls = new Map()
  walkAll(ast, (x) => { if (x.type === 'type_decl') decls.set(x.name, printType(x.typeExpr).trim()) })
  const base = (t, d = 0) => (decls.has(t) && d < 10 ? base(decls.get(t), d + 1) : t)
  return base
}

function procInfo(src, ast, mod, p, base) {
  const params = (gs) => gs.flatMap((g) => g.names.map((n) => ({ name: n, type: printType(g.typeExpr).trim() })))
  const inputs = params(p.inputs), outputs = params(p.outputs)
  const text = src.slice(p.span.start, p.span.end)
  const fsfOff = text.search(/\bFSF\s*:/)
  const fsf = p.body?.fsf
  const sl = (n) => src.slice(n.span.start, n.span.end)
  return {
    module: mod.name, name: p.name, span: p.span, leaf: !(p.body?.decomposition && String(p.body.decomposition.text ?? p.body.decomposition).trim()),
    inputs, outputs, ext: p.body?.ext ?? [], header: fsfOff >= 0 ? text.slice(0, fsfOff) : null, fsf,
    scenarios: fsf?.scenarios.map((s) => ({ test: sl(s.test), def: sl(s.def), node: s })) ?? [],
    others: fsf?.others ? sl(fsf.others) : null,
    numericInput: inputs.find((i) => ['nat', 'nat0', 'int'].includes(base(i.type))),
    base
  }
}

// ---------- structured derived FSF ----------
// scenario T: list of {v, op, k} conjunctions (or {v, op:'=', k:'<Enum>'})
const renderT = (t) => t.map((a) => `${a.v} ${a.op} ${a.k}`).join(' and ')
const renderFsf = (d) => d.scen.map((s) => `  ${renderT(s.t)} && ${s.d}`).join('\n||\n') + (d.others != null ? `\n||\n  others && ${d.others}` : '')
const renderProc = (pi, name, d) => `${pi.header.replace(new RegExp(`process\\s+${pi.name}\\b`), `process ${name}`).replace(/\/\*[\s\S]*?\*\//g, '').trimEnd()}\nFSF:\n${renderFsf(d)}\nend_process`
const holds = (a, x) => ({ '<': x < a.k, '<=': x <= a.k, '>': x > a.k, '>=': x >= a.k, '=': x === a.k })[a.op]
function truth(d, domain) {
  // returns { exclusive, complete } by enumeration (others counts for completeness)
  let exclusive = true, complete = true
  for (const x of domain) {
    const n = d.scen.filter((s) => s.t.every((a) => holds(a, x))).length
    if (n > 1) exclusive = false
    if (n === 0 && d.others == null) complete = false
  }
  return { exclusive, complete }
}

// ---------- main ----------
const commit = execSync('git rev-parse HEAD', { cwd: here }).toString().trim()
const srcDiff = execSync('git diff --stat exp-freeze-v1.1 -- src', { cwd: join(here, '..') }).toString().trim()
mkdirSync(join(OUT, 'mutants'), { recursive: true })
const rows = [], controls = [], derivedLog = [], findings = []

for (const specPath of SPECS) {
  const spec = basename(specPath, '.asfl')
  const orig = readFileSync(specPath, 'utf-8')
  const a0 = check(orig)
  const base = typeEnv(a0.ast)
  const infos = []
  for (const m of a0.ast.modules) for (const p of m.processes ?? []) infos.push(procInfo(orig, a0.ast, m, p, base))
  const leaves = infos.filter((p) => p.leaf && p.fsf && p.header)

  // ----- derive -----
  const derived = []
  for (const pi of leaves) {
    if (pi.scenarios.length !== 1 || !pi.numericInput) continue
    const x = pi.numericInput.name
    const D1 = pi.scenarios[0].def.trim(), D2 = (pi.others ?? D1).trim()
    const dom = base(pi.numericInput.type) === 'int' ? range(-5, K2 + 10) : range(0, K2 + 10)
    const mk = (suffix, scen, others) => ({ pi, name: `${pi.name}${suffix}`, x, dom, d: { scen, others } })
    derived.push(mk('_d2', [{ t: [{ v: x, op: '<=', k: K }], d: D1 }, { t: [{ v: x, op: '>', k: K }], d: D2 }], null))
    derived.push(mk('_d3', [{ t: [{ v: x, op: '<', k: K }], d: D1 }, { t: [{ v: x, op: '>=', k: K }, { v: x, op: '<=', k: K2 }], d: D2 }, { t: [{ v: x, op: '>', k: K2 }], d: D2 }], null))
    derived.push(mk('_dg', [{ t: [{ v: x, op: '<', k: K }], d: D1 }, { t: [{ v: x, op: '>', k: K }], d: D2 }], D2))
    derived.push(mk('_dc', [{ t: [{ v: x, op: '<=', k: K }], d: D1 }, { t: [{ v: x, op: '>', k: K }], d: D2 }], D2))
  }
  // insert all derived processes after their source process
  const insertAll = (src, ds) => {
    const byProc = new Map()
    for (const d of ds) byProc.set(d.pi.name, [...(byProc.get(d.pi.name) ?? []), d])
    const sorted = [...byProc.values()].sort((a, b) => b[0].pi.span.end - a[0].pi.span.end)
    let s = src
    for (const group of sorted) {
      const end = group[0].pi.span.end
      const semi = s.slice(0, end).trimEnd().endsWith(';')
      const body = group.map((d) => renderProc(d.pi, d.name, d.d))
      s = s.slice(0, end) + (semi ? '\n' + body.map((b) => b + ';').join('\n') : body.map((b) => ';\n' + b).join('')) + s.slice(end)
    }
    return s
  }
  // validate derived: each alone must give 0 errors in its process
  const valid = []
  for (const d of derived) {
    const r = await analyse(insertAll(orig, [d]))
    const errs = r.diags.filter((x) => x.severity === 'error' && x.process === d.name)
    const st = r.stats.find((s) => s.process === d.name)
    const encoded = st && st.tests.every((t) => t.status === 'encoded')
    if (process.env.FI_DEBUG && !encoded) { writeFileSync('/tmp/fi-dbg.asfl', insertAll(orig, [d])); console.error(d.name, JSON.stringify(st)); process.exit(1) }
    derivedLog.push({ spec, name: d.name, from: d.pi.name, x: d.x, errors: errs.map((e) => e.code).join(' '), encoded: !!encoded })
    if (r.parseOk && errs.length === 0 && encoded) valid.push(d)
  }
  const baseSrc = insertAll(orig, valid)
  writeFileSync(join(OUT, `${spec}.base.asfl`), baseSrc)
  const baseA = await analyse(baseSrc)
  // negative controls: every unmutated leaf + derived process
  const baseErrKeys = new Set(baseA.diags.filter((d) => d.severity === 'error').map((d) => `${d.process}|${d.code}|${d.message}`))
  for (const p of [...leaves.map((l) => ({ name: l.name, derived: false })), ...valid.map((v) => ({ name: v.name, derived: true }))]) {
    const ds = baseA.diags.filter((d) => d.process === p.name)
    controls.push({ spec, process: p.name, derived: p.derived, errors: ds.filter((d) => d.severity === 'error').map((d) => `${d.code}`).join(' '),
      warnings: ds.filter((d) => d.severity === 'warning').map((d) => d.code).join(' ') })
  }
  const baseInfos = []
  for (const m of baseA.ast.modules) for (const p of m.processes ?? []) baseInfos.push(procInfo(baseSrc, baseA.ast, m, p, base))
  const infoOf = (n) => baseInfos.find((p) => p.name === n)

  const candidates = { A1: [], A2: [], A3: [], B1: [], B2: [], B3: [], C1: [], C2: [], C3: [], C4: [] }
  const replaceProc = (pname, newText) => { const pi = infoOf(pname); return baseSrc.slice(0, pi.span.start) + newText + baseSrc.slice(pi.span.end) }

  // ----- class A / B on structured derived processes -----
  const clone = (d) => JSON.parse(JSON.stringify(d))
  for (const v of valid) {
    const add = (op, desc, nd, expectProp) => candidates[op].push({ spec, process: v.name, derived: true, operator: op, location: desc, expected: 'L2', prop: expectProp,
      src: () => replaceProc(v.name, renderProc(v.pi, v.name, nd)), truth: truth(nd, v.dom), mutantText: renderProc(v.pi, v.name, nd) })
    const s = v.d.scen
    // A1 widen strict bound whose complement is used in another T
    s.forEach((sc, i) => sc.t.forEach((a, j) => {
      if (a.op !== '<' && a.op !== '>') return
      const comp = a.op === '<' ? '>=' : '<='
      if (!s.some((o, k) => k !== i && o.t.some((b) => b.v === a.v && b.k === a.k && b.op === comp))) return
      const nd = clone(v.d); nd.scen[i].t[j].op = a.op + '='
      add('A1', `T${i + 1}: ${a.v} ${a.op} ${a.k} -> ${a.op}=`, nd, 'exclusion')
    }))
    // A2 drop a separating conjunct
    s.forEach((sc, i) => { if (sc.t.length < 2) return; sc.t.forEach((a, j) => {
      const nd = clone(v.d); nd.scen[i].t.splice(j, 1); add('A2', `T${i + 1}: drop conjunct '${a.v} ${a.op} ${a.k}'`, nd, 'exclusion')
    }) })
    // A3 duplicate T1 with other D
    { const nd = clone(v.d); nd.scen.push({ t: clone(s[0].t), d: s[s.length - 1].d }); add('A3', 'duplicate T1 as new scenario with D of last scenario', nd, 'exclusion') }
    // B1 remove others
    if (v.d.others != null) { const nd = clone(v.d); nd.others = null; add('B1', 'remove others branch', nd, 'completeness') }
    // B2 remove scenario (>=3, no others)
    if (s.length >= 3 && v.d.others == null) s.forEach((_, i) => { const nd = clone(v.d); nd.scen.splice(i, 1); add('B2', `remove scenario ${i + 1}`, nd, 'completeness') })
    // B3 narrow non-strict boundary (no others)
    if (v.d.others == null) s.forEach((sc, i) => sc.t.forEach((a, j) => {
      if (a.op !== '<=' && a.op !== '>=') return
      const nd = clone(v.d); nd.scen[i].t[j].op = a.op[0]; add('B3', `T${i + 1}: ${a.v} ${a.op} ${a.k} -> ${a.op[0]}`, nd, 'completeness')
    }))
  }
  // ----- class A / B on ORIGINAL multi-scenario leaf processes (text level) -----
  for (const pi of leaves.filter((p) => p.scenarios.length >= 2)) {
    const bi = infoOf(pi.name)
    const fsfStart = bi.fsf.span.start, fsfEnd = bi.fsf.span.end
    const pieces = bi.scenarios.map((s) => `  ${s.test.trim()} && ${s.def.trim()}`)
    const rebuild = (ps, others) => baseSrc.slice(0, fsfStart) + '\n' + ps.join('\n||\n') + (others ? `\n||\n  others && ${others}` : '') + '\n' + baseSrc.slice(fsfEnd).replace(/^\s*/, '')
    const fsfTextStart = baseSrc.slice(bi.span.start, fsfStart)
    const mk = (op, loc, ps, others, prop) => candidates[op].push({ spec, process: pi.name, derived: false, operator: op, location: loc, expected: 'L2', prop, src: () => rebuild(ps, others), truth: null })
    mk('A3', 'duplicate T1 as new scenario with D of last scenario', [...pieces, `  ${bi.scenarios[0].test.trim()} && ${bi.scenarios.at(-1).def.trim()}`], bi.others, 'exclusion')
    if (bi.others) mk('B1', 'remove others branch', pieces, null, 'completeness')
    if (pieces.length >= 3 && !bi.others) pieces.forEach((_, i) => mk('B2', `remove scenario ${i + 1}`, pieces.filter((__, k) => k !== i), null, 'completeness'))
    void fsfTextStart
  }
  // ----- class C on original + derived leaf processes (identifier-span edits) -----
  for (const bi of baseInfos.filter((p) => p.leaf && p.fsf && p.scenarios.length)) {
    const isDerived = valid.some((v) => v.name === bi.name)
    const inNames = new Set(bi.inputs.map((i) => i.name)), outNames = new Set(bi.outputs.map((o) => o.name))
    const wr = new Set(bi.ext.filter((e) => e.access === 'wr').map((e) => e.name))
    const sc = bi.scenarios[0]
    const tIds = idents(sc.node.test).filter((x) => inNames.has(x.name) && !x.oldState)
    const dIds = idents(sc.node.def)
    const edit = (span, txt) => () => baseSrc.slice(0, span.start) + txt + baseSrc.slice(span.end)
    const add = (op, loc, src, extra = {}) => candidates[op].push({ spec, process: bi.name, derived: isDerived, operator: op, location: loc, expected: 'L1', src, truth: null, ...extra })
    const tyOf = (n) => bi.base([...bi.inputs, ...bi.outputs].find((p) => p.name === n)?.type ?? '?')
    if (tIds.length && bi.outputs.length) {
      const t = tIds[0]
      const o = bi.outputs.find((q) => tyOf(q.name) === tyOf(t.name)) ?? bi.outputs[0]
      add('C1', `T1 line ${t.span.line}: input '${t.name}' -> output '${o.name}'`, edit(t.span, o.name), { typeMatch: tyOf(o.name) === tyOf(t.name) })
    }
    const outRefs = dIds.filter((x) => (outNames.has(x.name) || wr.has(x.name)) && !x.oldState)
    if (outRefs.length && bi.inputs.length) {
      const target = bi.inputs[0].name
      const spans = [...outRefs].sort((a, b) => b.span.start - a.span.start)
      add('C2', `D1: ${outRefs.length} output/wr refs (${[...new Set(outRefs.map((r) => r.name))].join(',')}) -> input '${target}'`,
        () => spans.reduce((s, r) => s.slice(0, r.span.start) + target + s.slice(r.span.end), baseSrc))
    }
    if (tIds.length) { const t = tIds[Math.floor(rand() * tIds.length)]; add('C3', `T1 line ${t.span.line}: '${t.name}' -> '~${t.name}'`, edit(t.span, `~${t.name}`)) }
    const dVar = dIds.find((x) => outNames.has(x.name) || wr.has(x.name) || inNames.has(x.name))
    if (dVar) add('C4', `D1 line ${dVar.span.line}: '${dVar.name}' -> 'undeclared_${dVar.name}'`, edit(dVar.span, `${dVar.oldState ? '~' : ''}undeclared_${dVar.name}`))
  }

  // ----- sample + run -----
  for (const [op, list] of Object.entries(candidates)) {
    const pick = shuffle(list).slice(0, Math.ceil(MAX / SPECS.length))
    for (const c of pick) {
      const id = `${spec.split('-')[0]}-${op}-${String(rows.filter((r) => r.operator === op).length + 1).padStart(2, '0')}`
      const msrc = c.src()
      writeFileSync(join(OUT, 'mutants', `${id}.asfl`), msrc)
      const r = await analyse(msrc)
      const at = r.diags.filter((d) => d.process === c.process)
      const errAt = (L) => at.filter((d) => d.layer === L && d.severity === 'error')
      const st = r.stats.find((s) => s.process === c.process)
      const fp = r.diags.filter((d) => d.severity === 'error' && d.process !== c.process && !baseErrKeys.has(`${d.process}|${d.code}|${d.message}`))
      let outcome
      const l2Undecided = st && (st.tests.some((t) => t.status !== 'encoded') || st.exclusion.some((e) => ['unknown', 'timeout', 'skipped'].includes(e.outcome)) ||
        ['unknown', 'timeout'].includes(st.completeness.outcome))
      const equivalent = c.truth && (c.prop === 'exclusion' ? c.truth.exclusive : c.truth.complete)
      if (!r.parseOk) outcome = 'unparseable'
      else if (equivalent) outcome = errAt(c.expected).length ? 'equivalent (but flagged!)' : 'equivalent'
      else if (errAt(c.expected).length) outcome = 'detected'
      else if (c.expected === 'L2' && l2Undecided) outcome = 'L2 unknown/unsupported'
      else if (errAt('L1').length || errAt('L2').length || errAt('parser').length) outcome = 'detected-by-other-layer'
      else outcome = 'missed'
      const codes = (L) => at.filter((d) => d.layer === L).map((d) => `${d.code}${d.severity === 'error' ? '' : '(w)'}`).join(' ')
      rows.push({ id, spec, process: c.process, kind: c.derived ? 'derived' : 'original', operator: op, class: op[0], location: c.location, expected: c.expected,
        parseOk: r.parseOk, parser: codes('parser'), L1: codes('L1'), L2: codes('L2'), groundTruthViolated: c.truth ? !equivalent : '', typeMatch: c.typeMatch ?? '',
        outcome, falsePositives: fp.map((d) => `${d.process}:${d.code}`).join(' '), mutant: `mutants/${id}.asfl` })
      process.stderr.write(`${id} ${c.process} ${outcome}\n`)
    }
  }
}
function range(a, b) { const o = []; for (let i = a; i <= b; i++) o.push(i); return o }

// ---------- outputs ----------
const csv = (list) => { const cols = Object.keys(list[0]); return [cols.join(','), ...list.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n' }
writeFileSync(join(OUT, 'results.csv'), csv(rows))
writeFileSync(join(OUT, 'controls.csv'), csv(controls))
writeFileSync(join(OUT, 'derived.csv'), csv(derivedLog))
const cats = ['detected', 'detected-by-other-layer', 'missed', 'equivalent', 'equivalent (but flagged!)', 'L2 unknown/unsupported', 'unparseable']
const tbl = (group) => {
  const keys = [...new Set(rows.map(group))].sort()
  let s = `| group | n | ${cats.join(' | ')} | FP mutants |\n|${'---|'.repeat(cats.length + 3)}\n`
  for (const k of keys) { const rr = rows.filter((r) => group(r) === k); s += `| ${k} | ${rr.length} | ${cats.map((c) => rr.filter((r) => r.outcome === c).length).join(' | ')} | ${rr.filter((r) => r.falsePositives).length} |\n` }
  return s
}
const ctlErr = controls.filter((c) => c.errors)
const summary = `# Fault-injection results (RQ3, no LLM)

- Date: ${day}; seed ${SEED}; up to ${Math.ceil(MAX / SPECS.length)} mutants per operator per spec (--max ${MAX} split over ${SPECS.length} specs, rounded up), i.e. up to ${Math.ceil(MAX / SPECS.length) * SPECS.length} per operator
- Tool commit: ${commit}
- \`git diff --stat exp-freeze-v1.1 -- packages/parser/src\`: ${srcDiff || '(empty)'} (L2 stats collector / leaf flag only; no diagnostic change)
- Rules: sofl/kb/paper-input/fault-injection-rules.md v0.1
- Specs: ${SPECS.map((s) => basename(s)).join(', ')}
- Derived processes: ${derivedLog.length} generated, ${derivedLog.filter((d) => !d.errors && d.encoded).length} valid (0 errors, all T encoded) — see derived.csv

## Negative controls (unmutated original + derived leaf processes in the base specs)
${controls.length} processes, ${ctlErr.length} with errors${ctlErr.length ? ': ' + ctlErr.map((c) => `${c.spec}/${c.process} (${c.errors})`).join(', ') : ''}.

## By class
${tbl((r) => r.class)}
## By operator
${tbl((r) => r.operator)}
## By operator and original/derived
${tbl((r) => `${r.operator} ${r.kind}`)}
## By layer that caught class C
${['C1', 'C2', 'C3', 'C4'].map((op) => `- ${op}: ` + JSON.stringify(Object.fromEntries(['parser', 'L1', 'L2'].map((L) => [L, rows.filter((r) => r.operator === op && r[L] && /\d(?!\(w\))( |$)/.test(r[L].replace(/\S+\(w\)/g, ''))).length])))).join('\n')}

## Non-detected mutants
${rows.filter((r) => !['detected', 'equivalent'].includes(r.outcome)).map((r) => `- ${r.id} ${r.process} (${r.kind}) ${r.operator} [${r.location}]: ${r.outcome}; parser=${r.parser || '-'} L1=${r.L1 || '-'} L2=${r.L2 || '-'}`).join('\n') || '(none)'}
`
writeFileSync(join(OUT, 'summary.md'), summary)
console.log(summary)
