import { ref } from 'vue'
import { installDasrRuntime } from '../../shared/dasr/runtime'
import type { DecisionLedger } from '../../shared/dasr/types'
import type { DasrMode } from '../../shared/dasr/flag'

export const decisionLedgerLabel = ref('no decisions registered')
export const decisionLedgerMode = ref<DasrMode>('C1')

export async function refreshDasrRuntime(projectRoot: string | null | undefined): Promise<void> {
  if (!projectRoot || !window.studio?.decisionLedgerLoad) return
  const loaded = await window.studio.decisionLedgerLoad(projectRoot)
  decisionLedgerLabel.value = loaded.label
  decisionLedgerMode.value = loaded.mode
  installDasrRuntime({
    enabled: loaded.enabled,
    mode: loaded.mode,
    ledger: loaded.ledger as DecisionLedger,
    persist: (ledger) => {
      void window.studio?.decisionLedgerSave?.(projectRoot, ledger)
    }
  })
}
