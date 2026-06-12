import type { ProcessNode, ProgramNode } from '@agile-sofl/parser'
import { sliceText, toSerializableSpan, type SerializableSpan } from './span.js'
import { findProcess } from './documentModel.js'

export interface FsfScenarioDto {
  id: string
  test: string
  def: string
  span: SerializableSpan
}

export interface FsfModelDto {
  processName: string
  /** Set when FSF belongs to a function rather than a process. */
  functionName?: string
  moduleName?: string
  span: SerializableSpan
  scenarios: FsfScenarioDto[]
  others?: string
  othersSpan?: SerializableSpan
}

export function buildFsfModel(processNode: ProcessNode, source: string): FsfModelDto | null {
  const fsf = processNode.body?.fsf
  if (!fsf) return null
  return buildFsfModelFromSpec(processNode.name, fsf, source)
}

export function buildFsfModelFromSpec(
  processName: string,
  fsf: NonNullable<NonNullable<ProcessNode['body']>['fsf']>,
  source: string
): FsfModelDto {
  const scenarios: FsfScenarioDto[] = fsf.scenarios.map((s, i: number) => ({
    id: `${processName}-scenario-${i + 1}`,
    test: sliceText(source, s.test.span),
    def: sliceText(source, s.def.span),
    span: toSerializableSpan(s.span)
  }))
  return {
    processName,
    span: toSerializableSpan(fsf.span),
    scenarios,
    others: fsf.others ? sliceText(source, fsf.others.span) : undefined,
    othersSpan: fsf.others ? toSerializableSpan(fsf.others.span) : undefined
  }
}

export function buildAllFsfModels(ast: ProgramNode, source: string): FsfModelDto[] {
  const models: FsfModelDto[] = []
  for (const mod of ast.modules) {
    for (const proc of mod.processes) {
      const model = buildFsfModel(proc, source)
      if (model) models.push({ ...model, moduleName: mod.name })
    }
    for (const fn of mod.functions) {
      if (!fn.fsf) continue
      models.push({
        ...buildFsfModelFromSpec(fn.name, fn.fsf, source),
        functionName: fn.name,
        moduleName: mod.name
      })
    }
  }
  return models
}

export function buildFsfModelByName(
  ast: ProgramNode,
  source: string,
  processName: string
): FsfModelDto | null {
  const proc = findProcess(ast, processName)
  if (!proc) return null
  return buildFsfModel(proc, source)
}
