import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { experienceFromFacts } from './experience'
import { taskBriefMarkdown } from './briefs'
import type { ExperienceJson, MetaJson, SessionEvent, Subject, SubjectFacts } from './types'

export function subjectDir(out: string, id: string): string {
  return join(out, id)
}

export function artifactsDir(out: string, id: string): string {
  return join(subjectDir(out, id), 'artifacts')
}

function copyIfExists(src: string, dst: string): void {
  if (!existsSync(src)) return
  mkdirSync(join(dst, '..'), { recursive: true })
  cpSync(src, dst, { recursive: true })
}

export function materialsComplete(dir: string): boolean {
  const need = [
    join(dir, 'meta.json'),
    join(dir, 'experience.json'),
    join(dir, 'informal.aspec'),
    join(dir, 'hybrid.asfl'),
    join(dir, 'session', 'events.jsonl'),
    join(dir, 'artifacts', 'informal.aspec'),
    join(dir, 'artifacts', 'hybrid.asfl')
  ]
  return need.every((p) => existsSync(p))
}

export function finalizeSubjectLayout(o: {
  out: string
  subject: Subject
  facts: SubjectFacts
  events: SessionEvent[]
  toolchainCommit: string
  toolchainTag: string
}): { dir: string; meta: MetaJson; experience: ExperienceJson } {
  const dir = subjectDir(o.out, o.subject.id)
  const art = artifactsDir(o.out, o.subject.id)
  const session = join(dir, 'session')
  mkdirSync(session, { recursive: true })
  mkdirSync(join(dir, 'screenshots'), { recursive: true })
  mkdirSync(join(dir, 'materials'), { recursive: true })

  const informal = existsSync(join(art, 'informal.aspec')) ? readFileSync(join(art, 'informal.aspec'), 'utf-8') : ''
  const hybrid = existsSync(join(art, 'hybrid.asfl')) ? readFileSync(join(art, 'hybrid.asfl'), 'utf-8') : ''
  writeFileSync(join(dir, 'informal.aspec'), informal)
  writeFileSync(join(dir, 'hybrid.asfl'), hybrid)
  if (existsSync(join(art, 'gui.html'))) {
    writeFileSync(join(dir, 'gui.html'), readFileSync(join(art, 'gui.html'), 'utf-8'))
  }

  writeFileSync(join(session, 'events.jsonl'), o.events.map((e) => JSON.stringify(e)).join('\n') + (o.events.length ? '\n' : ''))
  const llmSrc = join(art, '.agile-sofl', 'llm-calls.jsonl')
  if (existsSync(llmSrc)) writeFileSync(join(session, 'llm-calls.jsonl'), readFileSync(llmSrc))
  const sessSrc = join(art, '.agile-sofl', 'agent', 'sessions')
  if (existsSync(sessSrc)) copyIfExists(sessSrc, join(session, 'agent', 'sessions'))

  const transcripts: unknown[] = []
  if (existsSync(sessSrc)) {
    for (const f of readdirSync(sessSrc).filter((x) => x.endsWith('.json') && x !== '_index.json')) {
      try {
        transcripts.push(JSON.parse(readFileSync(join(sessSrc, f), 'utf-8')))
      } catch {
        /* skip */
      }
    }
  }
  writeFileSync(join(session, 'transcript.json'), JSON.stringify(transcripts, null, 2))

  writeFileSync(join(dir, 'materials', 'subject.json'), JSON.stringify(o.subject, null, 2))
  writeFileSync(join(dir, 'materials', 'task-brief.md'), taskBriefMarkdown(o.subject))
  writeFileSync(
    join(dir, 'screenshots', 'README.txt'),
    'Headless case-study-sim does not capture Electron screenshots. screenshotsPrepared=false.\n'
  )

  const experience = experienceFromFacts(o.facts)
  writeFileSync(join(dir, 'experience.json'), JSON.stringify(experience, null, 2) + '\n')

  const meta: MetaJson = {
    subjectType: 'agent-simulated',
    participantId: o.subject.id,
    modelId: o.facts.modelId,
    modelAlias: o.facts.modelAlias,
    temperature: o.facts.temperature,
    toolchainCommit: o.toolchainCommit,
    toolchainTag: o.toolchainTag,
    timeWindow: { startedAt: o.facts.startedAt, endedAt: o.facts.endedAt },
    materialsComplete: false,
    dryRun: o.facts.dryRun,
    project: o.subject.project,
    domain: o.subject.domain,
    task: o.subject.task
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  meta.materialsComplete = materialsComplete(dir)
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  return { dir, meta, experience }
}
