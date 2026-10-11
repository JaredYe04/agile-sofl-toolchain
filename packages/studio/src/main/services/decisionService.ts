import { ipcMain } from 'electron'
import { resolveDasrMode } from '../../shared/dasr/flag'
import { registrationLabel } from '../../shared/dasr/ledger'
import { readDasrFileConfig, readDecisionLedger, writeDecisionLedger } from '../../shared/dasr/store'
import type { DecisionLedger } from '../../shared/dasr/types'

export function registerDecisionHandlers(): void {
  ipcMain.handle('studio:decision-ledger-load', (_event, projectRoot: string) => {
    const flag = resolveDasrMode({ env: process.env, file: readDasrFileConfig(projectRoot) })
    const ledger = readDecisionLedger(projectRoot)
    return { enabled: flag.enabled, mode: flag.mode, ledger, label: registrationLabel(ledger) }
  })

  ipcMain.handle('studio:decision-ledger-save', (_event, projectRoot: string, ledger: DecisionLedger) => {
    writeDecisionLedger(projectRoot, ledger)
    return { ok: true, label: registrationLabel(readDecisionLedger(projectRoot)) }
  })
}
