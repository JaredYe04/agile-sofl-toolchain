import { FORM_VERSION } from './constants'
import type { ExperienceJson, SubjectFacts } from './types'

function joinTools(facts: SubjectFacts): string {
  const tools = facts.phases.flatMap((p) => p.tools)
  const counts = new Map<string, number>()
  for (const t of tools) counts.set(t, (counts.get(t) ?? 0) + 1)
  if (!counts.size) return '本场没有落地任何 propose_* 写入。'
  return [...counts].map(([t, n]) => `${t}×${n}`).join('、')
}

/**
 * Questionnaire fields. Tone may sound like an engineer; every clause is a session fact.
 * No invented quotes, opinions, or GUI stories.
 */
export function experienceFromFacts(facts: SubjectFacts): ExperienceJson {
  const stops = facts.stopReasons.length ? facts.stopReasons.join('；') : 'agent finished'
  const clar = facts.clarificationsAnswered
  const probe =
    `按任务包做了 ${facts.task}（${facts.initialModel} → ${facts.extension}）。` +
    `无头会话里规格代理共批准 ${facts.approvals} 次写入（${joinTools(facts)}），` +
    `澄清 ${clar} 次。各阶段停因：${stops}。` +
    `Informal ${facts.informalChars} 字，Hybrid ${facts.hybridChars} 字。` +
    (facts.dryRun ? ' 本场是 dry-run 本地假 LLM，没有打 ChatECNU。' : '')

  const feedback =
    `截图未准备：这次走的是冻结栈上的 agent-loop，不是 Electron 界面，screenshotsPrepared=false。` +
    `事件条数 ${facts.eventCount}，时间窗 ${facts.startedAt} ~ ${facts.endedAt}。` +
    `没有额外的口头评价；上面数字都来自本场日志。`

  return {
    formVersion: FORM_VERSION,
    submittedAt: facts.endedAt,
    participantId: facts.participantId,
    domain: facts.domain,
    yearsSpecWork: facts.yearsSpecWork,
    task: facts.task,
    initialModel: facts.initialModel,
    extension: facts.extension,
    probe,
    feedback,
    screenshotsPrepared: false
  }
}
