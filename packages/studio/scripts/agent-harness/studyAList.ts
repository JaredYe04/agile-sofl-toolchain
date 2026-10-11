/**
 * List Study A gold packages. This module does not import the agent loop,
 * so `node .harness/study-a.mjs --list` can run without a model or a built studio.
 */
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { listGoldFiles, type GoldListRow } from './studyAGold'

function listPathArg(): string | undefined {
  const index = process.argv.indexOf('--list')
  if (index < 0) return undefined
  const next = process.argv[index + 1]
  if (!next || next.startsWith('--')) return undefined
  return next
}

export function formatGoldList(rows: GoldListRow[]): string[] {
  const ids = rows.map((row) => row.scenarioId)
  if (new Set(ids).size !== ids.length) {
    throw Object.assign(new Error('scenario ids must be unique'), { exitCode: 2 })
  }
  const lines = rows.map((row) => [
    row.scenarioId,
    row.set ?? row.partition,
    row.status ?? '',
    row.kind,
    row.domain,
    `slots=${row.slots}`,
    `confirmatory=${row.confirmatory}`
  ].join('\t'))
  lines.push(JSON.stringify({ listed: rows.length, ids, modelRun: false }))
  return lines
}

export function goldListTargets(repo: string, explicit?: string): string[] {
  if (explicit) return [resolve(explicit)]
  return [
    join(repo, 'research-reframing', 'study-a', 'dev', 'scenarios'),
    join(repo, 'research-reframing', 'study-a', 'held-out', 'scenarios')
  ]
}

export function printStudyAList(): void {
  const repo = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()
  const rows = goldListTargets(repo, listPathArg()).flatMap((target) => listGoldFiles(target))
  for (const line of formatGoldList(rows)) console.log(line)
}
