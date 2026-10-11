import type { DecisionAuditEvent } from './types'

export type DasrLogger = (line: string) => void

let logger: DasrLogger = (line) => {
  console.info(line)
}

export function setDasrLogger(next: DasrLogger | null): void {
  logger = next ?? ((line) => console.info(line))
}

export function formatAuditLine(event: DecisionAuditEvent): string {
  return `[dasr] ${event.kind} decision=${event.decisionId ?? '-'} ${event.fromStatus ?? '-'} -> ${event.toStatus ?? '-'} elements=${event.elementIds.join(',') || '-'} path=${event.writePath ?? '-'} ${event.note}`
}

export function logAuditEvent(event: DecisionAuditEvent): void {
  if (event.kind === 'element-read') return
  logger(formatAuditLine(event))
}
