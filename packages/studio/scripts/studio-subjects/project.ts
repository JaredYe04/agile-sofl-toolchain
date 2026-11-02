import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { blankInformalMarkdown } from '@agile-sofl/aspec'
import { emptyGuiHtml } from '@agile-sofl/gui'
import type { AgentTurnContext } from '../../src/main/services/llm/agentLoop'
import { writeInformalSpecFile } from '../../src/main/services/informalMeta'
import { createProjectTemplate } from '../../src/main/services/projectManifest'
import type { StudioTexts } from '../../src/main/services/agentProposal'
import type { Subject } from './types'

export function readOptional(path: string | undefined): string | undefined {
  if (!path || !existsSync(path)) return undefined
  return readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function textsOf(ctx: AgentTurnContext): StudioTexts {
  return {
    informal: ctx.informalMarkdown ?? '',
    hybrid: ctx.hybridAsfl ?? '',
    gui: ctx.guiHtml ?? ''
  }
}

export function assignTexts(ctx: AgentTurnContext, texts: StudioTexts): void {
  ctx.informalMarkdown = texts.informal
  ctx.hybridAsfl = texts.hybrid
  ctx.guiHtml = texts.gui
}

/** Write the three Studio documents. Informal goes through the sidecar writer the project template uses. */
export function persistProject(root: string, texts: StudioTexts, subject: Subject): StudioTexts {
  writeInformalSpecFile(root, 'informal.aspec', texts.informal, {
    moduleId: subject.systemName,
    title: subject.project,
    hybridTarget: './hybrid.asfl',
    guiTarget: './gui.html'
  })
  const informal = readFileSync(join(root, 'informal.aspec'), 'utf-8')
  writeFileSync(join(root, 'hybrid.asfl'), texts.hybrid.endsWith('\n') ? texts.hybrid : `${texts.hybrid}\n`)
  writeFileSync(join(root, 'gui.html'), texts.gui.endsWith('\n') ? texts.gui : `${texts.gui}\n`)
  return { ...texts, informal, hybrid: readFileSync(join(root, 'hybrid.asfl'), 'utf-8'), gui: readFileSync(join(root, 'gui.html'), 'utf-8') }
}

/**
 * Real Studio project layout (`agile-sofl.json`, informal.aspec, hybrid.asfl, gui.html).
 * The agent loop stores sessions under `<project>/.agile-sofl/agent/sessions`.
 */
export function initSubjectProject(o: { projectRoot: string; subject: Subject; assetsDir: string }): AgentTurnContext {
  mkdirSync(o.projectRoot, { recursive: true })
  createProjectTemplate(o.projectRoot, o.subject.project)
  const informalFile = o.subject.seedInformalFile ? join(o.assetsDir, o.subject.seedInformalFile) : undefined
  const hybridFile = o.subject.seedHybridFile ? join(o.assetsDir, o.subject.seedHybridFile) : undefined
  const informal =
    readOptional(informalFile) ?? o.subject.seedInformal ?? blankInformalMarkdown(o.subject.project, './hybrid.asfl')
  const hybrid = readOptional(hybridFile) ?? o.subject.seedHybrid ?? `module SYSTEM_${o.subject.systemName};\nend_module\n`
  const gui = emptyGuiHtml(`${o.subject.systemName}App`, 'Home')
  const ctx: AgentTurnContext = {
    projectName: o.subject.project,
    projectRoot: o.projectRoot,
    moduleId: o.subject.systemName,
    informalMarkdown: informal,
    hybridAsfl: hybrid,
    guiHtml: gui
  }
  assignTexts(ctx, persistProject(o.projectRoot, textsOf(ctx), o.subject))
  return ctx
}
