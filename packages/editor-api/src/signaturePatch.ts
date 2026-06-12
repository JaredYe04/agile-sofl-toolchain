import { parse, type ProgramNode } from '@agile-sofl/parser'
import {
  validateFunctionSignature,
  validateProcessSignature,
  type SignatureValidationResult
} from './signatureValidation.js'

export { validateFunctionSignature, validateProcessSignature }
export type { SignatureValidationResult }

function normalizeModuleName(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function findModule(ast: ProgramNode, moduleName: string) {
  const bare = normalizeModuleName(moduleName)
  return ast.modules.find((m) => m.name === bare || m.name === moduleName)
}

function replaceProcessHeaderSignature(
  source: string,
  proc: { name: string; nameSpan?: { start: number; end: number }; span: { start: number } },
  signature: string
): string {
  const sig = signature.trim()
  const nameStart = proc.nameSpan?.start ?? proc.span.start
  const nameEnd = proc.nameSpan?.end ?? nameStart
  let lineEnd = nameEnd
  while (lineEnd < source.length && source[lineEnd] !== '\n') lineEnd++
  const prefix = source.slice(proc.span.start, nameEnd)
  return source.slice(0, proc.span.start) + `${prefix}${sig ? ` ${sig}` : ''}` + source.slice(lineEnd)
}

function replaceFunctionHeaderSignature(
  source: string,
  fn: { name: string; nameSpan?: { start: number; end: number }; span: { start: number } },
  signature: string
): string {
  const sig = signature.trim()
  const nameStart = fn.nameSpan?.start ?? fn.span.start
  const nameEnd = fn.nameSpan?.end ?? nameStart
  let lineEnd = nameEnd
  while (lineEnd < source.length && source[lineEnd] !== '\n') lineEnd++
  const prefix = source.slice(fn.span.start, nameEnd)
  const sigText = sig.startsWith('(') ? sig : `(${sig})`
  return source.slice(0, fn.span.start) + `${prefix}${sigText}` + source.slice(lineEnd)
}

export function patchProcessSignature(
  source: string,
  moduleName: string,
  processName: string,
  signature: string
): string {
  const check = validateProcessSignature(signature)
  if (!check.ok) return source
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const proc = mod?.processes.find((p) => p.name === processName)
  if (!proc || proc.alias) return source
  return replaceProcessHeaderSignature(source, proc, signature)
}

export function patchFunctionSignature(
  source: string,
  moduleName: string,
  functionName: string,
  signature: string
): string {
  const check = validateFunctionSignature(signature)
  if (!check.ok) return source
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const mod = findModule(ast, moduleName)
  const fn = mod?.functions.find((f) => f.name === functionName)
  if (!fn) return source
  return replaceFunctionHeaderSignature(source, fn, signature)
}
