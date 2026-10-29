import { FORM_VERSION } from './constants'
import type { ClarificationFact, ExperienceFeedback, ExperienceJson, ProposalFact, SubjectFacts } from './types'

function clip(text: string, n = 72): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return `${t.slice(0, Math.max(0, n - 1))}…`
}

function unique(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))]
}

function countBy(xs: string[]): string {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join('、')
}

function applied(facts: SubjectFacts): ProposalFact[] {
  return facts.proposals.filter((p) => p.applied)
}

function failed(facts: SubjectFacts): ProposalFact[] {
  return facts.proposals.filter((p) => !p.applied)
}

function matchedClars(facts: SubjectFacts): ClarificationFact[] {
  return facts.clarifications.filter((c) => c.matched && !c.unmatched)
}

function unmatchedClars(facts: SubjectFacts): ClarificationFact[] {
  return facts.clarifications.filter((c) => c.unmatched || !c.matched)
}

function taskScope(facts: SubjectFacts): string {
  if (facts.task === 'extension') {
    return `在已有「${facts.initialModel}」上扩展「${facts.extension}」`
  }
  return `新建「${facts.initialModel}」，再扩展「${facts.extension}」`
}

function questionsList(rows: ClarificationFact[], n = 3): string {
  const qs = unique(rows.map((c) => clip(c.question)).filter(Boolean))
  if (!qs.length) return ''
  return qs.slice(0, n).map((q) => `「${q}」`).join('、')
}

/**
 * Nested feedback aligned with human P1 (mostHelpful / mostDifficult / suggestion).
 * Every clause is a session fact: applied patches, clarification questions, matched
 * task-packet slots, apply errors, stop reasons. No invented quotes or opinions.
 */
export function mostHelpfulFromFacts(facts: SubjectFacts): string {
  const ok = applied(facts)
  const matched = matchedClars(facts)
  const parts: string[] = []
  parts.push(`任务包要求${taskScope(facts)}（${facts.domain}）。`)
  if (ok.length) {
    const tools = countBy(ok.map((p) => p.tool))
    const phases = unique(ok.map((p) => String(p.phase ?? '')))
    const kinds = unique(ok.flatMap((p) => p.opKinds))
    const notes = unique(ok.map((p) => clip(p.explanation, 48)).filter(Boolean)).slice(0, 3)
    parts.push(
      `工具实际落地了 ${ok.length} 次写入（${tools}${phases.length ? `，阶段 ${phases.join('→')}` : ''}）` +
        `${kinds.length ? `，操作 ${kinds.join('、')}` : ''}，把任务范围写进 Informal/Hybrid，而不是停在聊天文本里。`
    )
    if (notes.length) parts.push(`会话里的补丁说明：${notes.join('；')}。`)
  } else {
    parts.push('本场没有成功落地的 Informal/Hybrid 补丁，所以谈不上工具帮了建模写入。')
  }
  if (matched.length) {
    const slots = unique(matched.flatMap((c) => c.matchedSlotIds))
    parts.push(
      `模糊需求上，代理提问后有 ${matched.length} 次命中任务包事实` +
        `${slots.length ? `（slots: ${slots.join(', ')}）` : ''}，问题包括${questionsList(matched) || '（见 events）'}；` +
        `回写的是任务包原文拼接，没有另编阈值或权限。`
    )
  }
  return parts.join('')
}

export function mostDifficultFromFacts(facts: SubjectFacts): string {
  const unmatched = unmatchedClars(facts)
  const bad = failed(facts)
  const budget = facts.stopReasons.filter((s) => /budget|clarify_without_write/.test(s))
  const parts: string[] = []
  if (unmatched.length) {
    parts.push(
      `有 ${unmatched.length} 次澄清没命中任务包：${questionsList(unmatched) || '（问题见 events）'}。` +
        `这些只能回未授权答复，模糊点没被任务包收口。`
    )
  }
  if (bad.length) {
    const bits = bad.slice(0, 3).map((p) => `${p.tool}${p.applyError ? `：${clip(p.applyError, 40)}` : ' 未落地'}`)
    parts.push(`写入失败或未应用 ${bad.length} 次（${bits.join('；')}）。`)
  }
  if (budget.length) {
    parts.push(`阶段在预算/只澄清未写入处停下：${budget.join('；')}，规格可能还没覆盖完整任务包。`)
  }
  if (!parts.length) {
    parts.push(
      `日志里没有未命中澄清、写入失败或预算中断；剩余难度主要是把「${facts.initialModel}」扩到「${facts.extension}」这一任务本身。`
    )
  }
  return parts.join('')
}

export function suggestionFromFacts(facts: SubjectFacts): string {
  const unmatched = unmatchedClars(facts)
  const bad = failed(facts)
  const budget = facts.stopReasons.filter((s) => /budget/.test(s))
  const parts: string[] = []
  if (unmatched.length) {
    parts.push(
      `把未命中的澄清主题写进任务包授权事实（本场问题：${questionsList(unmatched) || '见 events'}），` +
        `这样 ask_clarification 能回已有条目，而不是停在未授权答复上。`
    )
  }
  if (bad.length) {
    parts.push('对已经失败的 CRUD 改走 propose_source_edit，这是本场日志里的失败路径，不是另想的功能。')
  }
  if (budget.length) {
    parts.push(`本场在 ${budget.join('、')} 用尽批准预算，拆小补丁或提高该阶段预算才能把任务包写完。`)
  }
  if (facts.dryRun) {
    parts.push('本场是 dry-run 本地假 LLM，问卷只反映这场落地事实；论文主分析应用冻结栈上的 ChatECNU 重跑。')
  }
  if (!facts.screenshotsPrepared) {
    parts.push('无头 agent-loop 没有界面截图；若论文需要屏幕证据，要另采，不能从本场编。')
  }
  if (!parts.length) {
    parts.push('按本场日志，保持任务包事实驱动即可，没有额外可从事件推出的改动。')
  }
  return parts.join('')
}

/** Probe: how fuzzy requirements were handled, from clarification events only. */
export function probeFromFacts(facts: SubjectFacts): string {
  const asked = facts.clarifications
  const matched = matchedClars(facts)
  const unmatched = unmatchedClars(facts)
  if (!asked.length) {
    return (
      `本场没有 ask_clarification。模糊需求没有被提问，规格只按任务包已写范围推进（${taskScope(facts)}）。` +
      (facts.dryRun ? ' dry-run 假 LLM 通常也不会问澄清。' : '')
    )
  }
  return (
    `代理就模糊需求提问 ${asked.length} 次。` +
    (matched.length
      ? `其中 ${matched.length} 次命中任务包并回写已有事实，问题包括${questionsList(matched)}。`
      : '没有一次命中任务包。') +
    (unmatched.length
      ? `未命中 ${unmatched.length} 次（${questionsList(unmatched)}），用了未授权答复，没有编造业务默认。`
      : '没有未命中澄清。')
  )
}

export function experienceFromFacts(facts: SubjectFacts): ExperienceJson {
  const feedback: ExperienceFeedback = {
    mostHelpful: mostHelpfulFromFacts(facts),
    mostDifficult: mostDifficultFromFacts(facts),
    suggestion: suggestionFromFacts(facts)
  }
  return {
    formVersion: FORM_VERSION,
    submittedAt: facts.endedAt,
    participantId: facts.participantId,
    domain: facts.domain,
    yearsSpecWork: facts.yearsSpecWork,
    task: facts.task,
    initialModel: facts.initialModel,
    extension: facts.extension,
    probe: probeFromFacts(facts),
    feedback,
    screenshotsPrepared: false
  }
}
