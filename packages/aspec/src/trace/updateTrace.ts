import { contentHash } from '../buildInformalModel.js'
import type { TraceabilityGraph } from '../model.js'
import { parseTraceJson } from './coverage.js'

export function updateTraceContentHash(traceJson: string, aspecSource: string): string {
  const trace = parseTraceJson(traceJson)
  if (!trace) return traceJson
  const next: TraceabilityGraph = {
    ...trace,
    contentHash: contentHash(aspecSource)
  }
  return JSON.stringify(next, null, 2)
}
