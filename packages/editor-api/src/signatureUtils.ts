import { printType, type ParamGroupNode, type ProcessNode, type FunctionNode } from '@agile-sofl/parser'

export type ParamGroupDto = {
  names: string
  type: string
}

function printParams(groups: ParamGroupNode[]): string {
  return groups.map((g) => `${g.names.join(',')}: ${printType(g.typeExpr)}`).join(', ')
}

export function paramGroupsFromNodes(groups: ParamGroupNode[]): ParamGroupDto[] {
  return groups.map((g) => ({
    names: g.names.join(','),
    type: printType(g.typeExpr)
  }))
}

export function buildProcessSignatureFromGroups(inputs: ParamGroupDto[], outputs: ParamGroupDto[]): string {
  const inPart = inputs
    .filter((g) => g.names.trim() || g.type.trim())
    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)
    .join(', ')
  const header = `(${inPart})`
  const outPart = outputs
    .filter((g) => g.names.trim() || g.type.trim())
    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)
    .join(', ')
  return outPart ? `${header} ${outPart}` : header
}

export function buildFunctionSignatureFromGroups(params: ParamGroupDto[], returnType: string): string {
  const paramPart = params
    .filter((g) => g.names.trim() || g.type.trim())
    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)
    .join(', ')
  return `(${paramPart}): ${returnType.trim() || 'nat'}`
}

/** Process signature text after name, e.g. `(x: nat) ok: nat` or `()`. */
export function processSignatureText(proc: ProcessNode): string {
  if (proc.alias) return ''
  const inputs = `(${printParams(proc.inputs)})`
  if (!proc.outputs.length) return inputs
  return `${inputs} ${printParams(proc.outputs)}`
}

/** Function signature text, e.g. `(amount: nat): nat`. */
export function functionSignatureText(fn: FunctionNode): string {
  return `(${printParams(fn.params)}): ${printType(fn.returnType)}`
}
