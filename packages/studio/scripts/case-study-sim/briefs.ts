import type { PhaseName, Subject } from './types'

/**
 * Task-packet user texts. Labeled as 任务包 so they are not mistaken for interview quotes.
 * Content is taken only from the subject table (domain / models / extension).
 */
export function taskBriefMarkdown(s: Subject): string {
  return [
    `# 任务包 ${s.id}（briefing, not a quote）`,
    '',
    `- 项目：${s.project}`,
    `- 领域：${s.domain}`,
    `- 任务类型：${s.task}`,
    `- 规格工作年限档：${s.yearsSpecWork}`,
    `- 初始模型：${s.initialModel}`,
    `- 扩展：${s.extension}`,
    '',
    '只使用本任务包已写明的范围。缺业务规则时用 ask_clarification；不要编造阈值、权限或策略。',
    '产物：Informal（Functions / Data Resources / Constraints）与 Hybrid（.asfl）。不操作 Electron GUI。'
  ].join('\n')
}

export function phaseUserText(s: Subject, phase: PhaseName): string {
  const common =
    `任务包（不是访谈摘录）id=${s.id} 项目=${s.project} 领域=${s.domain}。` +
    `只使用任务包事实。缺规则就 ask_clarification，不要编造。`
  if (phase === 'informal') {
    return (
      `${common} 这是 ${s.task === 'greenfield' ? '新建' : '已有系统上的'} Informal 阶段。` +
      `请把 Informal 写成 Functions / Data Resources / Constraints，覆盖初始范围：${s.initialModel}。` +
      `写完后读一遍 inventory，缺了再补，不要一次 dump 整份文档。`
    )
  }
  if (phase === 'hybrid') {
    return (
      `${common} Informal 已在 informal.aspec。请增量生成 Hybrid，系统模块名 SYSTEM_${s.systemName}。` +
      `覆盖初始范围：${s.initialModel}。不要 replace-document 整文件。完成后给任务摘要。`
    )
  }
  return (
    `${common} 扩展阶段：在已有规格上增加「${s.extension}」。` +
    `保留初始范围「${s.initialModel}」，除非任务包明确要求改掉。先改 Informal 再改 Hybrid。`
  )
}

export function promptExtras(s: Subject): string {
  return (
    `Simulated software-engineer subject ${s.id} (${s.yearsSpecWork} spec-work band, domain ${s.domain}). ` +
    `subjectType=agent-simulated. Do not invent business rules or quote a human participant.`
  )
}
