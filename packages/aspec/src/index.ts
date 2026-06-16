export * from './model.js'
export { parseAspec } from './parse.js'
export { validateAspec } from './validate.js'
export { serializeAspec } from './serialize.js'
export { buildInformalModel, buildInformalModelFromDocument, contentHash } from './buildInformalModel.js'
export { resolveModuleParents } from './resolveParents.js'
export { refineToAsfl, traceToJson } from './refine/refineToAsfl.js'
export {
  buildCoverageReport,
  mergeTraceability,
  parseTraceJson
} from './trace/coverage.js'
export { updateTraceContentHash } from './trace/updateTrace.js'
export {
  patchAspec,
  patchAspecField,
  patchFieldById,
  formatAspec,
  patchBookAlign,
  addAspecProcess,
  removeAspecProcess,
  addAspecScenario,
  addAspecModule,
  addAspecType,
  removeAspecType,
  addAspecVar,
  removeAspecVar,
  addAspecInv,
  removeAspecInv,
  addAspecFunction,
  removeAspecFunction,
  addAspecConst,
  removeAspecConst
} from './patch.js'
export type { PatchAspecAction } from './patch.js'
export { validateBookAlign } from './validateBookAlign.js'
export { mergeExistingAsfl } from './refine/mergeAsfl.js'
export { buildFunctionFsf, shouldRenderFunctionFsf } from './refine/fsfBuilder.js'
export { buildGuiBlockForRefine } from './refine/guiBlockBuilder.js'
export type { MergeStrategy, ProcessMergePlan } from './refine/mergeAsfl.js'
export { attachDiagnosticLines, offsetAtLine } from './sourceSpans.js'
export { scanProject } from './projectScan.js'

import { check } from '@agile-sofl/parser'
import type { RefineOptions, RefineResult, AspecDiagnostic } from './model.js'
import { parseAspec } from './parse.js'
import { refineToAsfl } from './refine/refineToAsfl.js'

export function refineAspecWithCheck(
  source: string,
  options?: RefineOptions & { existingAsfl?: string }
): RefineResult & { checkOk: boolean } {
  const { document } = parseAspec(source)
  if (!document) {
    return {
      asflText: '',
      traceability: { traceVersion: '1.0', links: [] },
      warnings: [],
      checkOk: false
    }
  }
  const result = refineToAsfl(document, source, {
    ...options,
    existingAsfl: options?.existingAsfl
  })
  const checkResult = check(result.asflText)
  const checkDiagnostics: AspecDiagnostic[] = checkResult.diagnostics.map((d) => ({
    code: d.code,
    message: d.message,
    severity: d.severity as AspecDiagnostic['severity']
  }))
  return {
    ...result,
    checkDiagnostics,
    checkOk: !checkResult.diagnostics.some((d) => d.severity === 'error')
  }
}
