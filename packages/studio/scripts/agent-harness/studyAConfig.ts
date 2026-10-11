/**
 * Freeze record for a Study A run.
 * Confirmatory data collection needs a new tag cut after DASR landed.
 * exp-freeze-v1.2 is the pre-DASR pilot freeze and is not that tag.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { AGENT_TOOLS, skillById } from '../../src/main/services/llm/skills'
import { applyDasrToolSurface, DASR_PROMPT_APPENDIX } from '../../src/shared/dasr/tools'
import { FREEZE_TAG } from './freeze'
import { UNMATCHED_ORACLE_REPLY, ORACLE_PROTOCOL } from './studyAOracle'
import { GOLD_SCHEMA_VERSION } from './studyAGoldTypes'

export const CONFIRMATORY_FREEZE_NOTE =
  'Confirmatory Study A runs must freeze a new tag after DASR has landed. exp-freeze-v1.2 is the pre-DASR pilot freeze and is not the confirmatory freeze.'

export const STUDY_A_USER_TEXT =
  'Generate the Hybrid Specification from the Informal Specification. Strategy: rebuild (no existing Hybrid). Work incrementally with the tools. If a business choice is not stated in the informal specification, ask before writing it as a confirmed rule.'

export const STUDY_A_SKILL_ID = 'hybrid-generation'

export const C0_DEFERRED = {
  status: 'deferred-secondary' as const,
  reason:
    'The studio has no generic-chat mode. Condition B1 is an external baseline: if that label is set, the agent still runs as T with tools, skills, and the write gate, so it is not a fair C0. A fair C0 would be the same model id, the same temperature, a frozen tool-free prompt, and the same token budget, logged on this harness. That path is not implemented. The primary contrast is C1 versus C2 on the existing agent.'
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function studyASchemaHashes() {
  const baseTools = stable(AGENT_TOOLS)
  const c1Tools = stable(applyDasrToolSurface(AGENT_TOOLS, false))
  const c2Tools = stable(applyDasrToolSurface(AGENT_TOOLS, true))
  return {
    skillId: STUDY_A_SKILL_ID,
    skillPromptSha256: sha256Text(skillById(STUDY_A_SKILL_ID).prompt),
    userTextSha256: sha256Text(STUDY_A_USER_TEXT),
    baseToolSchemaSha256: sha256Text(baseTools),
    c1ToolSchemaSha256: sha256Text(c1Tools),
    c2ToolSchemaSha256: sha256Text(c2Tools),
    dasrAppendixSha256: sha256Text(DASR_PROMPT_APPENDIX),
    unmatchedOracleReplySha256: sha256Text(UNMATCHED_ORACLE_REPLY),
    oracleProtocol: ORACLE_PROTOCOL,
    goldSchemaVersion: GOLD_SCHEMA_VERSION
  }
}

export interface StudyAConfig {
  study: 'A'
  confirmatory: boolean
  confirmatoryFreezeTag: string | null
  confirmatoryFreezeNote: string
  pilotFreezeTag: string
  gitCommit: string
  pilotFreezeCommit: string | null
  pilotFreezeMatchesHead: boolean
  configuredModelId: string
  temperature: number
  temperatureSource: string
  agentCondition: 'T'
  conditions: Array<'C1' | 'C2'>
  dasrFlag: {
    C1: { env: '0'; dasrMode: 'C1'; enabled: false }
    C2: { env: '1'; dasrMode: 'C2'; enabled: true }
  }
  hashes: ReturnType<typeof studyASchemaHashes>
  harnessSha256: string
  goldSchemaSha256: string | null
  c0: typeof C0_DEFERRED
  toolSchemaNote: string
}

export function buildStudyAConfig(input: {
  gitCommit: string
  pilotFreezeCommit: string | null
  configuredModelId: string
  harnessSha256: string
  goldSchemaPath?: string
}): StudyAConfig {
  let goldSchemaSha256: string | null = null
  if (input.goldSchemaPath) {
    try {
      goldSchemaSha256 = sha256Text(readFileSync(input.goldSchemaPath, 'utf-8').replace(/\r\n/g, '\n'))
    } catch {
      goldSchemaSha256 = null
    }
  }
  return {
    study: 'A',
    confirmatory: false,
    confirmatoryFreezeTag: null,
    confirmatoryFreezeNote: CONFIRMATORY_FREEZE_NOTE,
    pilotFreezeTag: FREEZE_TAG,
    gitCommit: input.gitCommit,
    pilotFreezeCommit: input.pilotFreezeCommit,
    pilotFreezeMatchesHead: Boolean(input.pilotFreezeCommit) && input.pilotFreezeCommit === input.gitCommit,
    configuredModelId: input.configuredModelId,
    temperature: 0.35,
    temperatureSource: 'PILOT_TEMPERATURE in packages/studio/scripts/agent-harness/core.ts, sent as 0.35 by agentLoop.ts',
    agentCondition: 'T',
    conditions: ['C1', 'C2'],
    dasrFlag: {
      C1: { env: '0', dasrMode: 'C1', enabled: false },
      C2: { env: '1', dasrMode: 'C2', enabled: true }
    },
    hashes: studyASchemaHashes(),
    harnessSha256: input.harnessSha256,
    goldSchemaSha256,
    c0: C0_DEFERRED,
    toolSchemaNote:
      'c1ToolSchemaSha256 matches the base agent tools. c2ToolSchemaSha256 adds the DASR tool surface. That difference is the condition, not drift. The generation permission filter (informal read-only, hybrid read/write) is the same for C1 and C2.'
  }
}

/** Confirmatory mode refuses the pilot tag and a tag that is not the current commit. */
export function assertConfirmatoryFreeze(tag: string, head: string, tagCommit: string): void {
  if (tag === FREEZE_TAG) {
    throw Object.assign(new Error(`${CONFIRMATORY_FREEZE_NOTE} Refusing --freeze-tag ${tag}.`), { exitCode: 2 })
  }
  if (!tag.trim() || tag !== tag.trim()) {
    throw Object.assign(new Error('--freeze-tag must be a non-empty tag name'), { exitCode: 2 })
  }
  if (head !== tagCommit) {
    throw Object.assign(new Error(`confirmatory freeze refused: HEAD ${head} is not ${tag} (${tagCommit})`), { exitCode: 2 })
  }
}
