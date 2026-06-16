import { parseAspec } from './parse.js'
import { serializeAspec } from './serialize.js'
import type {
  AspecDocument,
  InformalModule,
  InformalProcess,
  InformalScenario,
  InformalFunction,
  InformalType,
  InformalVar,
  InformalInv,
  InformalConst,
  BookAlignSection
} from './model.js'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function findModule(doc: AspecDocument, moduleId: string): InformalModule | undefined {
  return doc.modules.find((m) => m.id === moduleId)
}

function findProcess(doc: AspecDocument, moduleId: string, processId: string): InformalProcess | undefined {
  return findModule(doc, moduleId)?.processes?.find((p) => p.id === processId)
}

export function patchAspecField(source: string, path: string, value: unknown): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  setByPath(doc, path, value)
  return serializeAspec(doc)
}

/** Patch by stable entity id, e.g. `process.proc-borrow.description` or `system.purpose`. */
export function patchFieldById(source: string, idPath: string, value: unknown): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const parts = idPath.split('.')
  if (parts.length < 2) return patchAspecField(source, idPath, value)

  const [kind, id, ...rest] = parts
  const field = rest.join('.')

  if (kind === 'system') {
    setByPath(doc, `system.${id}`, value)
    return serializeAspec(doc)
  }

  if (kind === 'module') {
    const mod = doc.modules.find((m) => m.id === id)
    if (!mod) return source
    if (!field) return source
    setOnObject(mod as unknown as Record<string, unknown>, field, value)
    return serializeAspec(doc)
  }

  if (kind === 'process') {
    for (const mod of doc.modules) {
      const proc = mod.processes?.find((p) => p.id === id)
      if (proc && field) {
        setOnObject(proc as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  if (kind === 'scenario') {
    const scenarioId = id
    const fieldName = field
    for (const mod of doc.modules) {
      for (const proc of mod.processes ?? []) {
        const scen = proc.scenarios?.find((s) => s.id === scenarioId)
        if (scen && fieldName) {
          setOnObject(scen as unknown as Record<string, unknown>, fieldName, value)
          return serializeAspec(doc)
        }
      }
    }
    return source
  }

  if (kind === 'const') {
    for (const mod of doc.modules) {
      const c = mod.constants?.find((x) => x.id === id)
      if (c && field) {
        setOnObject(c as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  if (kind === 'function') {
    for (const mod of doc.modules) {
      const fn = mod.functions?.find((f) => f.id === id)
      if (fn && field) {
        setOnObject(fn as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  if (kind === 'type') {
    for (const mod of doc.modules) {
      const ty = mod.types?.find((t) => t.id === id)
      if (ty && field) {
        setOnObject(ty as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  if (kind === 'var') {
    for (const mod of doc.modules) {
      const v = mod.variables?.find((x) => x.id === id)
      if (v && field) {
        setOnObject(v as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  if (kind === 'inv') {
    for (const mod of doc.modules) {
      const inv = mod.invariants?.find((x) => x.id === id)
      if (inv && field) {
        setOnObject(inv as unknown as Record<string, unknown>, field, value)
        return serializeAspec(doc)
      }
    }
    return source
  }

  return patchAspecField(source, idPath, value)
}

function setOnObject(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split('.')
  let cur: unknown = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const key = segs[i]!
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[key]
  }
  const last = segs[segs.length - 1]!
  if (cur && typeof cur === 'object') (cur as Record<string, unknown>)[last] = value
}

function setByPath(doc: AspecDocument, path: string, value: unknown): void {
  const parts = path.split('.')
  let cur: unknown = doc
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!
    const idx = Number(key)
    if (Array.isArray(cur) && !Number.isNaN(idx)) {
      cur = cur[idx]
    } else if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key]
    }
  }
  const last = parts[parts.length - 1]!
  const idx = Number(last)
  if (Array.isArray(cur) && !Number.isNaN(idx)) {
    cur[idx] = value
  } else if (cur && typeof cur === 'object') {
    ;(cur as Record<string, unknown>)[last] = value
  }
}

export function addAspecProcess(source: string, moduleId: string, process: InformalProcess): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = doc.modules.find((m) => m.id === moduleId)
  if (!mod) return source
  if (!mod.processes) mod.processes = []
  mod.processes.push(process)
  return serializeAspec(doc)
}

export function removeAspecProcess(source: string, moduleId: string, processId: string): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = doc.modules.find((m) => m.id === moduleId)
  if (!mod?.processes) return source
  mod.processes = mod.processes.filter((p) => p.id !== processId)
  return serializeAspec(doc)
}

export function addAspecScenario(
  source: string,
  moduleId: string,
  processId: string,
  scenario: InformalScenario
): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const proc = findProcess(doc, moduleId, processId)
  if (!proc) return source
  if (!proc.scenarios) proc.scenarios = []
  proc.scenarios.push(scenario)
  return serializeAspec(doc)
}

export function removeAspecScenario(
  source: string,
  moduleId: string,
  processId: string,
  scenarioId: string
): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const proc = findProcess(doc, moduleId, processId)
  if (!proc?.scenarios) return source
  proc.scenarios = proc.scenarios.filter((s) => s.id !== scenarioId)
  return serializeAspec(doc)
}

export function addAspecModule(source: string, module: InformalModule): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  doc.modules.push(module)
  return serializeAspec(doc)
}

export function removeAspecModule(source: string, moduleId: string): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  doc.modules = doc.modules.filter((m) => m.id !== moduleId)
  return serializeAspec(doc)
}

export function addAspecFunction(
  source: string,
  moduleId: string,
  fn: InformalFunction
): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = findModule(doc, moduleId)
  if (!mod) return source
  if (!mod.functions) mod.functions = []
  mod.functions.push(fn)
  return serializeAspec(doc)
}

export function removeAspecFunction(source: string, moduleId: string, functionId: string): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = findModule(doc, moduleId)
  if (!mod?.functions) return source
  mod.functions = mod.functions.filter((f) => f.id !== functionId)
  return serializeAspec(doc)
}

function addEntity<T>(
  source: string,
  moduleId: string,
  key: 'types' | 'variables' | 'invariants' | 'constants',
  entity: T
): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = findModule(doc, moduleId)
  if (!mod) return source
  const list = (mod[key] ??= [] as never) as T[]
  list.push(entity)
  return serializeAspec(doc)
}

function removeEntity(
  source: string,
  moduleId: string,
  key: 'types' | 'variables' | 'invariants' | 'constants',
  entityId: string
): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  const mod = findModule(doc, moduleId)
  if (!mod?.[key]) return source
  ;(mod[key] as Array<{ id: string }>) = (mod[key] as Array<{ id: string }>).filter((e) => e.id !== entityId)
  return serializeAspec(doc)
}

export function addAspecConst(source: string, moduleId: string, constant: InformalConst): string {
  return addEntity(source, moduleId, 'constants', constant)
}

export function removeAspecConst(source: string, moduleId: string, constId: string): string {
  return removeEntity(source, moduleId, 'constants', constId)
}

export function addAspecType(source: string, moduleId: string, type: InformalType): string {
  return addEntity(source, moduleId, 'types', type)
}

export function removeAspecType(source: string, moduleId: string, typeId: string): string {
  return removeEntity(source, moduleId, 'types', typeId)
}

export function addAspecVar(source: string, moduleId: string, variable: InformalVar): string {
  return addEntity(source, moduleId, 'variables', variable)
}

export function removeAspecVar(source: string, moduleId: string, varId: string): string {
  return removeEntity(source, moduleId, 'variables', varId)
}

export function addAspecInv(source: string, moduleId: string, inv: InformalInv): string {
  return addEntity(source, moduleId, 'invariants', inv)
}

export function removeAspecInv(source: string, moduleId: string, invId: string): string {
  return removeEntity(source, moduleId, 'invariants', invId)
}

export function patchBookAlign(source: string, bookAlign: BookAlignSection): string {
  const { document } = parseAspec(source)
  if (!document) return source
  const doc = clone(document)
  doc.bookAlign = bookAlign
  return serializeAspec(doc)
}

export function formatAspec(source: string): string {
  const { document } = parseAspec(source)
  if (!document) return source
  return serializeAspec(document)
}

export type PatchAspecAction =
  | { action: 'patch-field'; path: string; value: unknown }
  | { action: 'patch-by-id'; idPath: string; value: unknown }
  | { action: 'add-process'; moduleId: string; process: InformalProcess }
  | { action: 'remove-process'; moduleId: string; processId: string }
  | { action: 'add-scenario'; moduleId: string; processId: string; scenario: InformalScenario }
  | { action: 'remove-scenario'; moduleId: string; processId: string; scenarioId: string }
  | { action: 'add-module'; module: InformalModule }
  | { action: 'remove-module'; moduleId: string }
  | { action: 'add-function'; moduleId: string; function: InformalFunction }
  | { action: 'remove-function'; moduleId: string; functionId: string }
  | { action: 'add-type'; moduleId: string; type: InformalType }
  | { action: 'remove-type'; moduleId: string; typeId: string }
  | { action: 'add-variable'; moduleId: string; variable: InformalVar }
  | { action: 'remove-variable'; moduleId: string; variableId: string }
  | { action: 'add-invariant'; moduleId: string; invariant: InformalInv }
  | { action: 'remove-invariant'; moduleId: string; invariantId: string }
  | { action: 'add-constant'; moduleId: string; constant: InformalConst }
  | { action: 'remove-constant'; moduleId: string; constantId: string }
  | { action: 'patch-book-align'; bookAlign: BookAlignSection }

export function patchAspec(source: string, payload: PatchAspecAction): string {
  switch (payload.action) {
    case 'patch-field':
      return patchAspecField(source, payload.path, payload.value)
    case 'patch-by-id':
      return patchFieldById(source, payload.idPath, payload.value)
    case 'add-process':
      return addAspecProcess(source, payload.moduleId, payload.process)
    case 'remove-process':
      return removeAspecProcess(source, payload.moduleId, payload.processId)
    case 'add-scenario':
      return addAspecScenario(source, payload.moduleId, payload.processId, payload.scenario)
    case 'remove-scenario':
      return removeAspecScenario(source, payload.moduleId, payload.processId, payload.scenarioId)
    case 'add-module':
      return addAspecModule(source, payload.module)
    case 'remove-module':
      return removeAspecModule(source, payload.moduleId)
    case 'add-function':
      return addAspecFunction(source, payload.moduleId, payload.function)
    case 'remove-function':
      return removeAspecFunction(source, payload.moduleId, payload.functionId)
    case 'add-type':
      return addAspecType(source, payload.moduleId, payload.type)
    case 'remove-type':
      return removeAspecType(source, payload.moduleId, payload.typeId)
    case 'add-variable':
      return addAspecVar(source, payload.moduleId, payload.variable)
    case 'remove-variable':
      return removeAspecVar(source, payload.moduleId, payload.variableId)
    case 'add-invariant':
      return addAspecInv(source, payload.moduleId, payload.invariant)
    case 'remove-invariant':
      return removeAspecInv(source, payload.moduleId, payload.invariantId)
    case 'add-constant':
      return addAspecConst(source, payload.moduleId, payload.constant)
    case 'remove-constant':
      return removeAspecConst(source, payload.moduleId, payload.constantId)
    case 'patch-book-align':
      return patchBookAlign(source, payload.bookAlign)
    default:
      return source
  }
}
