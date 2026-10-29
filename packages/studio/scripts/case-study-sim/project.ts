import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { blankInformalMarkdown } from '@agile-sofl/aspec'
import { emptyGuiHtml } from '@agile-sofl/gui'
import { createProjectTemplate } from '../../src/main/services/projectManifest'
import { writeInformalSpecFile } from '../../src/main/services/informalMeta'
import type { AgentTurnContext } from '../../src/main/services/llm/agentLoop'
import type { Subject } from './types'

export function readOptional(path: string | undefined): string | undefined {
  if (!path || !existsSync(path)) return undefined
  return readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function initSubjectProject(o: {
  artifactsRoot: string
  subject: Subject
  fixtureDir: string
}): AgentTurnContext {
  mkdirSync(o.artifactsRoot, { recursive: true })
  createProjectTemplate(o.artifactsRoot, o.subject.project)
  const informalFile = o.subject.seedInformalFile
    ? join(o.fixtureDir, o.subject.seedInformalFile)
    : undefined
  const hybridFile = o.subject.seedHybridFile ? join(o.fixtureDir, o.subject.seedHybridFile) : undefined
  const informal =
    readOptional(informalFile) ??
    o.subject.seedInformal ??
    blankInformalMarkdown(o.subject.project, './hybrid.asfl')
  const hybrid =
    readOptional(hybridFile) ??
    o.subject.seedHybrid ??
    `module SYSTEM_${o.subject.systemName};\nend_module\n`
  const gui = emptyGuiHtml(`${o.subject.systemName}App`, 'Home')
  writeInformalSpecFile(o.artifactsRoot, 'informal.aspec', informal, {
    moduleId: o.subject.systemName,
    title: o.subject.project,
    hybridTarget: './hybrid.asfl',
    guiTarget: './gui.html'
  })
  writeFileSync(join(o.artifactsRoot, 'hybrid.asfl'), hybrid)
  writeFileSync(join(o.artifactsRoot, 'gui.html'), gui)
  mkdirSync(join(o.artifactsRoot, '.agile-sofl'), { recursive: true })
  return {
    projectName: o.subject.project,
    projectRoot: o.artifactsRoot,
    moduleId: o.subject.systemName,
    informalMarkdown: informal,
    hybridAsfl: hybrid,
    guiHtml: gui
  }
}
