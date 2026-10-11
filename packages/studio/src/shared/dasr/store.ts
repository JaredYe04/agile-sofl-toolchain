import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { emptyLedger, ledgerFromJson } from './ledger'
import type { DecisionLedger } from './types'

export const LEDGER_FILENAME = 'decision-ledger.json'

export function decisionLedgerPath(projectRoot: string): string {
  return join(projectRoot, '.agile-sofl', LEDGER_FILENAME)
}

export function readDasrFileConfig(projectRoot: string | undefined): { dasr?: unknown; dasrMode?: unknown } | null {
  if (!projectRoot) return null
  const file = join(projectRoot, '.agile-sofl', 'experiment.json')
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as { dasr?: unknown; dasrMode?: unknown }
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** A missing file is an empty ledger: "no decisions registered". The file is not created. */
export function readDecisionLedger(projectRoot: string | undefined): DecisionLedger {
  if (!projectRoot) return emptyLedger()
  const file = decisionLedgerPath(projectRoot)
  if (!existsSync(file)) return emptyLedger()
  try {
    return ledgerFromJson(JSON.parse(readFileSync(file, 'utf-8')))
  } catch {
    return ledgerFromJson(null)
  }
}

export function writeDecisionLedger(projectRoot: string, ledger: DecisionLedger): void {
  if (ledger.registration === 'unreadable') return
  if (ledger.registration === 'empty' && ledger.decisions.length === 0) return
  const file = decisionLedgerPath(projectRoot)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, 'utf-8')
}
