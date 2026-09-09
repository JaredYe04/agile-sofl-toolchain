import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app } from 'electron'
import type { AgileSoflManifest } from '../../shared/projectTypes.js'
import {
  asflIdent,
  createProjectTemplate,
  normalizeManifest,
  writeManifest
} from './projectManifest.js'
import { inferModuleIdFromAsfl, writeInformalSpecFile } from './informalMeta.js'

export interface ProjectTemplateEntry {
  id: string
  titleKey: string
  descriptionKey: string
  category: 'basic' | 'example'
  useEmptyProject?: boolean
  informal?: string
  hybrid?: string[]
  gui?: string
  guiHybrid?: string
  guiModule?: string
}

const STANDARD_INFORMAL = 'informal.aspec'
const STANDARD_HYBRID = 'hybrid.asfl'
const STANDARD_GUI = 'gui.guispec'

export function resolveTemplatesDir(): string {
  const candidates = [
    join(__dirname, '../renderer/templates'),
    join(__dirname, '../../public/templates'),
    join(app.getAppPath(), 'public/templates')
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'project-manifest.json'))) return dir
  }
  throw new Error('Project templates directory not found')
}

export function loadProjectTemplateManifest(templatesDir?: string): ProjectTemplateEntry[] {
  const dir = templatesDir ?? resolveTemplatesDir()
  const raw = JSON.parse(readFileSync(join(dir, 'project-manifest.json'), 'utf-8')) as {
    templates: ProjectTemplateEntry[]
  }
  return raw.templates
}

export function findProjectTemplate(
  templateId: string,
  templatesDir?: string
): ProjectTemplateEntry | undefined {
  return loadProjectTemplateManifest(templatesDir).find((entry) => entry.id === templateId)
}

function readTemplateFile(templatesDir: string, file: string): string {
  return readFileSync(join(templatesDir, file), 'utf-8')
}

function rewriteCrossRefs(
  content: string,
  entry: ProjectTemplateEntry,
  _projectName: string
): string {
  let out = content
  const hybridSrc = entry.hybrid?.[0]
  if (hybridSrc) {
    out = out.replaceAll(`./${hybridSrc}`, `./${STANDARD_HYBRID}`)
    out = out.replaceAll(hybridSrc, STANDARD_HYBRID)
  }
  if (entry.informal) {
    out = out.replaceAll(`./${entry.informal}`, `./${STANDARD_INFORMAL}`)
    out = out.replaceAll(entry.informal, STANDARD_INFORMAL)
  }
  if (entry.gui) {
    out = out.replaceAll(`./${entry.gui}`, `./${STANDARD_GUI}`)
    out = out.replaceAll(entry.gui, STANDARD_GUI)
  }
  return out
}

function writeProjectInformal(
  root: string,
  markdown: string,
  projectName: string,
  hybridContent: string,
  hasGui: boolean
): void {
  writeInformalSpecFile(root, STANDARD_INFORMAL, markdown, {
    title: projectName,
    moduleId: inferModuleIdFromAsfl(hybridContent) ?? asflIdent(projectName),
    hybridTarget: `./${STANDARD_HYBRID}`,
    guiTarget: hasGui ? `./${STANDARD_GUI}` : undefined
  })
}

function writeStubInformal(root: string, projectName: string, hybridContent: string): void {
  writeProjectInformal(
    root,
    `# Functions\n\n# Data Resources\n\n# Constraints\n`,
    projectName,
    hybridContent,
    true
  )
}

function appendGuiModule(hybrid: string, guiSrc: string): string {
  if (/\bmodule\s+GUI_/.test(hybrid)) return hybrid
  const body = hybrid.replace(/\s*$/, '\n')
  const snippet = guiSrc.endsWith('\n') ? guiSrc : `${guiSrc}\n`
  return `${body}${snippet}`
}

export function createProjectFromTemplate(
  root: string,
  name: string,
  templateId: string,
  templatesDir?: string
): AgileSoflManifest {
  const dir = templatesDir ?? resolveTemplatesDir()
  const entry = findProjectTemplate(templateId, dir)
  if (!entry) {
    throw new Error(`Unknown project template: ${templateId}`)
  }
  if (entry.useEmptyProject) {
    return createProjectTemplate(root, name)
  }

  mkdirSync(root, { recursive: true })
  const hybridSources = entry.hybrid ?? []
  if (hybridSources.length === 0) {
    throw new Error(`Project template "${templateId}" has no hybrid files`)
  }

  const hybridPaths: string[] = []
  if (hybridSources.length === 1) {
    let hybridContent = readTemplateFile(dir, hybridSources[0]!)
    if (entry.guiHybrid) {
      hybridContent = appendGuiModule(hybridContent, readTemplateFile(dir, entry.guiHybrid))
    }
    writeFileSync(join(root, STANDARD_HYBRID), hybridContent, 'utf-8')
    hybridPaths.push(STANDARD_HYBRID)

    if (entry.informal) {
      writeProjectInformal(
        root,
        rewriteCrossRefs(readTemplateFile(dir, entry.informal), entry, name),
        name,
        hybridContent,
        Boolean(entry.gui)
      )
    } else {
      writeStubInformal(root, name, hybridContent)
    }
  } else {
    let firstContent = ''
    for (const src of hybridSources) {
      const dest = basename(src)
      const content = readTemplateFile(dir, src)
      writeFileSync(join(root, dest), content, 'utf-8')
      hybridPaths.push(dest)
      if (!firstContent) firstContent = content
    }
    if (entry.informal) {
      writeProjectInformal(
        root,
        rewriteCrossRefs(readTemplateFile(dir, entry.informal), entry, name),
        name,
        firstContent,
        Boolean(entry.gui)
      )
    } else {
      writeStubInformal(root, name, firstContent)
    }
  }

  let guiPath: string | undefined
  if (entry.gui) {
    const guiContent = rewriteCrossRefs(readTemplateFile(dir, entry.gui), entry, name)
    writeFileSync(join(root, STANDARD_GUI), guiContent, 'utf-8')
    guiPath = STANDARD_GUI
  }

  const manifest = normalizeManifest(
    {
      name,
      informal: STANDARD_INFORMAL,
      hybrid: hybridPaths,
      gui: guiPath,
      guiModule: guiPath ? entry.guiModule ?? 'GUI_App' : entry.guiModule
    },
    basename(root)
  )
  writeManifest(root, manifest)
  return manifest
}
