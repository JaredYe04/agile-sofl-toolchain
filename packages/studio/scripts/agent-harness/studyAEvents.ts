import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { StudyEvent, StudyEventBody } from './studyATypes'

export function createStudyEventLog(file: string) {
  mkdirSync(dirname(file), { recursive: true })
  let seq = 0
  return {
    file,
    append(body: StudyEventBody): StudyEvent {
      const event = { seq: ++seq, ...body } as StudyEvent
      appendFileSync(file, JSON.stringify(event) + '\n', 'utf-8')
      return event
    }
  }
}

export function readStudyEvents(file: string): StudyEvent[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StudyEvent)
}
