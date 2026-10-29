import { freezeStatus, FREEZE_TAG, type FreezeStatus } from '../agent-harness/freeze'

export { freezeStatus, FREEZE_TAG, type FreezeStatus }

export const freezeRefuse = (msg: string): Error => Object.assign(new Error(msg), { exitCode: 2 })

export function requireFreeze(status: FreezeStatus, dryRun: boolean): FreezeStatus {
  if (status.ok) return status
  const extra = status.changedToolFiles.length ? `\n  e.g. ${status.changedToolFiles.slice(0, 8).join('\n  ')}` : ''
  throw freezeRefuse(
    `freeze check FAILED: ${status.reasons.join('; ')}${extra}\n` +
      `Case-study-sim must run on ${FREEZE_TAG} (node scripts/agent-harness/prepare-v12.mjs or scripts/case-study-sim/prepare.mjs).` +
      (dryRun ? ' --dry-run still requires the freeze worktree.' : '')
  )
}
