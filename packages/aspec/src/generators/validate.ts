import type { HybridSpecificationIR, HybridProcessIR, HybridTypeIR, SemanticModuleIR } from './types.js'

export interface IrValidationResult {
  ok: boolean
  errors: string[]
  ir: HybridSpecificationIR
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function sanitizeIdent(name: string, fallback: string): string {
  const trimmed = name.trim()
  if (IDENT.test(trimmed)) return trimmed
  const cleaned = trimmed.replace(/[^A-Za-z0-9_]/g, '_')
  if (IDENT.test(cleaned)) return cleaned
  return fallback
}

function sanitizeProcess(p: Partial<HybridProcessIR>, index: number): HybridProcessIR {
  return {
    id: typeof p.id === 'string' ? p.id : undefined,
    name: sanitizeIdent(p.name || `Process${index + 1}`, `Process${index + 1}`),
    informalId: typeof p.informalId === 'string' ? p.informalId : undefined,
    description: typeof p.description === 'string' ? p.description : undefined,
    inputs: asArray<{ name?: string; typeHint?: string }>(p.inputs).map((i, j) => ({
      name: sanitizeIdent(i?.name || `in${j + 1}`, `in${j + 1}`),
      typeHint: (i?.typeHint || 'nat').trim()
    })),
    outputs: asArray<{ name?: string; typeHint?: string }>(p.outputs).map((o, j) => ({
      name: sanitizeIdent(o?.name || `out${j + 1}`, `out${j + 1}`),
      typeHint: (o?.typeHint || 'nat').trim()
    })),
    ext: asArray<{ access?: string; name?: string; typeHint?: string }>(p.ext).map((e) => ({
      access: e?.access === 'wr' ? 'wr' : 'rd',
      name: sanitizeIdent(e?.name || 'ext_var', 'ext_var'),
      typeHint: e?.typeHint
    })),
    pre: typeof p.pre === 'string' ? p.pre : undefined,
    post: typeof p.post === 'string' ? p.post : undefined,
    preconditions: asArray<string>(p.preconditions).filter((s): s is string => typeof s === 'string'),
    postconditions: asArray<string>(p.postconditions).filter((s): s is string => typeof s === 'string'),
    scenarios: asArray<{
      id?: string
      name?: string
      guard?: string
      definingCondition?: string
      exceptional?: boolean
    }>(p.scenarios).map((s, j) => ({
      id: typeof s?.id === 'string' ? s.id : undefined,
      name: typeof s?.name === 'string' ? s.name : `S${j + 1}`,
      guard: typeof s?.guard === 'string' ? s.guard : 'true',
      definingCondition: typeof s?.definingCondition === 'string' ? s.definingCondition : 'true',
      exceptional: Boolean(s?.exceptional)
    })),
    children: asArray(p.children).filter((s): s is string => typeof s === 'string'),
    formalizationStatus: p.formalizationStatus === 'formal' || p.formalizationStatus === 'mixed' ? p.formalizationStatus : 'semi-formal'
  }
}

export function normalizeHybridIR(raw: unknown, fallback: HybridSpecificationIR): IrValidationResult {
  const errors: string[] = []
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<HybridSpecificationIR>) : {}
  const moduleName = sanitizeIdent(
    parsed.moduleName || fallback.moduleName || 'SYSTEM_System',
    fallback.moduleName
  )
  const types: HybridTypeIR[] = asArray<HybridTypeIR>(parsed.types).map((t, i) => ({
    id: typeof t?.id === 'string' ? t.id : undefined,
    name: sanitizeIdent(t?.name || `Type${i + 1}`, `Type${i + 1}`),
    informalId: typeof t?.informalId === 'string' ? t.informalId : undefined,
    fields: asArray<{ name?: string; typeHint?: string; description?: string }>(t?.fields).map((f, j) => ({
      name: sanitizeIdent(f?.name || `field${j + 1}`, `field${j + 1}`),
      typeHint: (f?.typeHint || 'string').trim(),
      description: typeof f?.description === 'string' ? f.description : undefined
    }))
  }))
  const variables = asArray<{ name?: string; typeHint?: string; informalId?: string }>(parsed.variables).map((v, i) => ({
    name: sanitizeIdent(v?.name || `var${i + 1}`, `var${i + 1}`),
    typeHint: (v?.typeHint || 'nat').trim(),
    informalId: typeof v?.informalId === 'string' ? v.informalId : undefined
  }))
  const processes = asArray<Partial<HybridProcessIR>>(parsed.processes).map((p, i) => sanitizeProcess(p, i))
  const invariants = asArray<{
    id?: string
    name?: string
    informalId?: string
    description?: string
  }>(parsed.invariants).map((inv, i) => ({
    id: typeof inv?.id === 'string' ? inv.id : undefined,
    name: sanitizeIdent(inv?.name || `Inv${i + 1}`, `Inv${i + 1}`),
    informalId: typeof inv?.informalId === 'string' ? inv.informalId : undefined,
    description: typeof inv?.description === 'string' ? inv.description : `Invariant ${i + 1}`
  }))

  const modules: SemanticModuleIR[] | undefined = Array.isArray(parsed.modules)
    ? parsed.modules.map((m, i) => ({
        id: typeof m?.id === 'string' ? m.id : undefined,
        name: sanitizeIdent(m?.name || `Module${i + 1}`, `Module${i + 1}`),
        types: asArray(m?.types),
        variables: asArray(m?.variables),
        processes: asArray<Partial<HybridProcessIR>>(m?.processes).map((p, j) => sanitizeProcess(p, j)),
        invariants: asArray(m?.invariants)
      }))
    : undefined

  if (!types.length && !fallback.types.length && processes.length === 0) {
    errors.push('Hybrid IR has no types or processes')
  }

  const ir: HybridSpecificationIR = {
    moduleName: moduleName.startsWith('SYSTEM_') ? moduleName : `SYSTEM_${moduleName.replace(/^SYSTEM_/, '')}`,
    modules,
    types: types.length ? types : fallback.types,
    variables: variables.length ? variables : fallback.variables,
    processes: processes.length ? processes : fallback.processes,
    invariants: invariants.length ? invariants : fallback.invariants
  }

  return { ok: errors.length === 0, errors, ir }
}
