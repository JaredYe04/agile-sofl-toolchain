export type ScenarioKind = 'normal' | 'exceptional'

export interface ScenarioCandidate {
  id: string
  name: string
  kind: ScenarioKind
  guard: string
  definingCondition: string
}

export type EvalValue = string | number | boolean | null

export interface ScenarioMatchResult {
  matched: ScenarioCandidate[]
  unevaluable: boolean
  outputs: Record<string, EvalValue>
}

type Token =
  | { t: 'id'; v: string }
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'op'; v: string }
  | { t: 'eof' }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = src.trim()
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (s.startsWith('and', i) && /\W/.test(s[i + 3] ?? ' ')) {
      tokens.push({ t: 'op', v: 'and' })
      i += 3
      continue
    }
    if (s.startsWith('or', i) && /\W/.test(s[i + 2] ?? ' ')) {
      tokens.push({ t: 'op', v: 'or' })
      i += 2
      continue
    }
    if (s.startsWith('not', i) && /\W/.test(s[i + 3] ?? ' ')) {
      tokens.push({ t: 'op', v: 'not' })
      i += 3
      continue
    }
    if (s.startsWith('<>', i) || s.startsWith('<=', i) || s.startsWith('>=', i)) {
      tokens.push({ t: 'op', v: s.slice(i, i + 2) })
      i += 2
      continue
    }
    if ('=<>'.includes(c)) {
      tokens.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '(' || c === ')') {
      tokens.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '"' || c === "'") {
      const q = c
      i++
      let out = ''
      while (i < s.length && s[i] !== q) {
        out += s[i]
        i++
      }
      i++
      tokens.push({ t: 'str', v: out })
      continue
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(s[i + 1] ?? ''))) {
      const m = s.slice(i).match(/^-?\d+(?:\.\d+)?/)
      tokens.push({ t: 'num', v: Number(m![0]) })
      i += m![0].length
      continue
    }
    if (/[A-Za-z_\u0080-\uFFFF]/.test(c)) {
      const m = s.slice(i).match(/^[A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*/)
      const word = m![0]
      if (word === 'true' || word === 'false') tokens.push({ t: 'bool', v: word === 'true' })
      else tokens.push({ t: 'id', v: word })
      i += word.length
      continue
    }
    return [{ t: 'eof' }]
  }
  tokens.push({ t: 'eof' })
  return tokens
}

function coerce(v: EvalValue): EvalValue {
  if (v === 'true') return true
  if (v === 'false') return false
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return v
}

function cmp(op: string, a: EvalValue, b: EvalValue): boolean | null {
  const x = coerce(a)
  const y = coerce(b)
  if (x == null || y == null) return null
  switch (op) {
    case '=':
      return x === y || String(x) === String(y)
    case '<>':
      return x !== y && String(x) !== String(y)
    case '<':
      return typeof x === 'number' && typeof y === 'number' ? x < y : String(x) < String(y)
    case '>':
      return typeof x === 'number' && typeof y === 'number' ? x > y : String(x) > String(y)
    case '<=':
      return typeof x === 'number' && typeof y === 'number' ? x <= y : String(x) <= String(y)
    case '>=':
      return typeof x === 'number' && typeof y === 'number' ? x >= y : String(x) >= String(y)
    default:
      return null
  }
}

function tokenValue(tok: Token): EvalValue {
  if (tok.t === 'id' || tok.t === 'str' || tok.t === 'op') return tok.v
  if (tok.t === 'num' || tok.t === 'bool') return tok.v
  return null
}

export function evalSimpleCondition(expr: string, env: Record<string, EvalValue>): boolean | null {
  const text = expr.trim()
  if (!text || text === 'true') return true
  if (text === 'false') return false
  const tokens = tokenize(text)
  if (tokens.length === 1) return null
  let i = 0
  const peek = () => tokens[i]!
  const eat = () => tokens[i++]!
  const isOp = (tok: Token, v: string) => tok.t === 'op' && tok.v === v

  function parsePrimary(): boolean | null {
    const tok = eat()
    if (isOp(tok, 'not')) {
      const inner = parsePrimary()
      return inner == null ? null : !inner
    }
    if (isOp(tok, '(')) {
      const inner = parseOr()
      if (isOp(peek(), ')')) eat()
      return inner
    }
    if (tok.t === 'bool') return tok.v
    const next = peek()
    const nextOp = next.t === 'op' ? next.v : ''
    if (tok.t === 'id' && !'=<>'.includes(nextOp[0] ?? '')) {
      const val = coerce(env[tok.v] ?? null)
      if (typeof val === 'boolean') return val
      return val != null && val !== '' && val !== 0
    }
    const left: EvalValue = tok.t === 'id' ? (env[tok.v] ?? null) : tokenValue(tok)
    const op = eat()
    if (op.t !== 'op') return null
    const rightTok = eat()
    const right: EvalValue = rightTok.t === 'id' ? (env[rightTok.v] ?? null) : tokenValue(rightTok)
    return cmp(op.v, left, right)
  }

  function parseAnd(): boolean | null {
    let acc = parsePrimary()
    while (isOp(peek(), 'and')) {
      eat()
      const rhs = parsePrimary()
      if (acc == null || rhs == null) acc = null
      else acc = acc && rhs
    }
    return acc
  }

  function parseOr(): boolean | null {
    let acc = parseAnd()
    while (isOp(peek(), 'or')) {
      eat()
      const rhs = parseAnd()
      if (acc == null || rhs == null) acc = null
      else acc = acc || rhs
    }
    return acc
  }

  try {
    return parseOr()
  } catch {
    return null
  }
}

export function applyDefiningOutputs(def: string, env: Record<string, EvalValue>): Record<string, EvalValue> {
  const next = { ...env }
  const parts = def.split(/\band\b|,/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const m = part.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/)
    if (!m) continue
    const name = m[1]!
    const raw = m[2]!.trim()
    if (raw === 'true' || raw === 'false') next[name] = raw === 'true'
    else if (/^-?\d+(?:\.\d+)?$/.test(raw)) next[name] = Number(raw)
    else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      next[name] = raw.slice(1, -1)
    } else if (raw in env) next[name] = env[raw]!
    else next[name] = raw
  }
  return next
}

export function matchScenarios(
  scenarios: ScenarioCandidate[],
  env: Record<string, EvalValue>
): ScenarioMatchResult {
  const matched: ScenarioCandidate[] = []
  let unevaluable = scenarios.length === 0
  for (const scenario of scenarios) {
    const result = evalSimpleCondition(scenario.guard || 'true', env)
    if (result == null) unevaluable = true
    else if (result) matched.push(scenario)
  }
  const chosen = matched[0]
  const outputs = chosen ? applyDefiningOutputs(chosen.definingCondition, env) : { ...env }
  return { matched, unevaluable: unevaluable && matched.length === 0, outputs }
}
