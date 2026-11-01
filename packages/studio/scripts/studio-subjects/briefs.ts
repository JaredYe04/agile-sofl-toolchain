import type { PhaseName, Subject } from './types'

/**
 * Task-packet text sent to the specification agent.
 * Labeled as a briefing so it is not mistaken for an interview quote.
 * Content comes only from the subject table.
 */
export function taskBriefMarkdown(subject: Subject): string {
  return [
    `# 任务包 ${subject.id}（briefing, not a quote）`,
    '',
    `- 项目：${subject.project}`,
    `- 领域：${subject.domain}`,
    `- 任务类型：${subject.task}`,
    `- 规格工作年限档：${subject.yearsSpecWork}`,
    `- 初始模型：${subject.initialModel}`,
    `- 扩展：${subject.extension}`,
    '',
    '只使用本任务包已写明的范围。缺业务规则时用 ask_clarification；不要编造阈值、权限或策略。',
    '产物：Informal（Functions / Data Resources / Constraints）与 Hybrid（.asfl）。',
    '写入必须走 propose_* 工具，由 Studio 的 Apply / Reject 路径处理。'
  ].join('\n')
}

export function phaseUserText(subject: Subject, phase: PhaseName): string {
  const common =
    `任务包（不是访谈摘录）id=${subject.id} 项目=${subject.project} 领域=${subject.domain}。` +
    `初始范围：${subject.initialModel}。只使用任务包事实。缺规则就 ask_clarification，不要编造。`
  if (phase === 'informal') {
    return (
      `${common} 这是 ${subject.task === 'greenfield' ? '新建' : '已有系统上的'} Informal 阶段。` +
      `请把 Informal 写成 Functions / Data Resources / Constraints，覆盖初始范围：${subject.initialModel}。` +
      `写完后读一遍 inventory，缺了再补，不要一次 dump 整份文档。`
    )
  }
  if (phase === 'hybrid') {
    return (
      `${common} Informal 已在 informal.aspec。请增量生成 Hybrid，系统模块名 SYSTEM_${subject.systemName}。` +
      `覆盖初始范围：${subject.initialModel}。不要 replace-document 整文件。完成后给任务摘要。`
    )
  }
  return (
    `${common} 扩展阶段：在已有规格上增加「${subject.extension}」。` +
    `保留初始范围「${subject.initialModel}」，除非任务包明确要求改掉。先改 Informal 再改 Hybrid。`
  )
}

export function promptExtras(subject: Subject): string {
  return (
    `Simulated software-engineer subject ${subject.id} (${subject.yearsSpecWork} spec-work band, domain ${subject.domain}). ` +
    `subjectType=agent-simulated. Do not invent business rules or quote a human participant.`
  )
}
