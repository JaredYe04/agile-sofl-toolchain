import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, join, relative } from 'node:path'
import {
  MANIFEST_FILENAME,
  type AgileSoflManifest
} from '../../shared/projectTypes.js'
import { writeInformalSpecFile } from './informalMeta.js'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])

function scanSpecFiles(root: string, ext: string, out: string[] = []): string[] {
  if (!existsSync(root)) return out
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
    const full = join(root, name)
    const st = statSync(full)
    if (st.isDirectory()) scanSpecFiles(full, ext, out)
    else if (name.endsWith(ext)) out.push(full)
  }
  return out
}

function scanProjectRoot(root: string): {
  aspecFiles: string[]
  asflFiles: string[]
  guispecFiles: string[]
} {
  return {
    aspecFiles: scanSpecFiles(root, '.aspec'),
    asflFiles: scanSpecFiles(root, '.asfl'),
    guispecFiles: scanSpecFiles(root, '.guispec')
  }
}

export function manifestPath(root: string): string {
  return join(root, MANIFEST_FILENAME)
}

export function readManifest(root: string): AgileSoflManifest | null {
  const path = manifestPath(root)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<AgileSoflManifest>
    if (!raw || typeof raw.name !== 'string') return null
    return normalizeManifest(raw, basename(root))
  } catch {
    return null
  }
}

export function writeManifest(root: string, manifest: AgileSoflManifest): void {
  writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
}

export function normalizeManifest(
  raw: Partial<AgileSoflManifest>,
  fallbackName: string
): AgileSoflManifest {
  const hybrid = Array.isArray(raw.hybrid)
    ? raw.hybrid.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : []
  return {
    version: '1.0',
    name: raw.name?.trim() || fallbackName,
    guiModule: raw.guiModule?.trim() || undefined,
    informal: raw.informal?.trim() || 'informal.aspec',
    hybrid: hybrid.length ? hybrid : ['hybrid.asfl'],
    gui: raw.gui?.trim() || undefined
  }
}

export async function loadOrCreateManifest(root: string): Promise<AgileSoflManifest> {
  const existing = readManifest(root)
  if (existing) return existing
  const inferred = await inferManifest(root)
  writeManifest(root, inferred)
  return inferred
}

export async function inferManifest(root: string): Promise<AgileSoflManifest> {
  const scan = scanProjectRoot(root)
  const informalRel = toRel(root, scan.aspecFiles[0]) ?? 'informal.aspec'
  const hybrid = scan.asflFiles.map((p) => toRel(root, p)!).filter(Boolean)
  const guiRel = toRel(root, scan.guispecFiles[0])
  const base = basename(scan.aspecFiles[0] ?? '', '.aspec')
  const pairGui =
    scan.guispecFiles.find((p) => basename(p, '.guispec') === `${base}-gui`) ??
    scan.guispecFiles.find((p) => basename(p, '.guispec') === base.replace(/-informal$/, '') + '-gui')
  return {
    version: '1.0',
    name: basename(root),
    informal: informalRel,
    hybrid: hybrid.length ? hybrid : ['hybrid.asfl'],
    gui: guiRel ?? (pairGui ? toRel(root, pairGui) : undefined)
  }
}

function toRel(root: string, abs?: string): string | undefined {
  if (!abs) return undefined
  return relative(root, abs).replace(/\\/g, '/')
}

export function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'NewSystem'
}

export function asflIdent(name: string): string {
  const ident = slugifyProjectName(name).replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(ident) ? ident : `System_${ident}`
}

export function createProjectTemplate(root: string, name: string): AgileSoflManifest {
  mkdirSync(root, { recursive: true })
  const ident = asflIdent(name)
  const informal = 'informal.aspec'
  const hybrid = 'hybrid.asfl'
  const gui = 'gui.guispec'
  const manifest: AgileSoflManifest = {
    version: '1.0',
    name,
    guiModule: 'GUI_App',
    informal,
    hybrid: [hybrid],
    gui
  }

  writeInformalSpecFile(
    root,
    informal,
    `# Functions\n\n# Data Resources\n\n# Constraints\n`,
    {
      moduleId: ident,
      title: name,
      hybridTarget: `./${hybrid}`,
      guiTarget: `./${gui}`
    }
  )

  writeFileSync(
    join(root, hybrid),
    `module SYSTEM_${ident};
end_module
module GUI_App / ${ident};
const
    view_home = 0;
    view_next = 1;
type
    ViewId = nat;
var
    current_view: ViewId;
inv
    current_view >= 0 and current_view <= 1;
gui AppGui;
screen Home;
    label welcome "Welcome";
    navigation goNext "Open" triggers OpenNext;
end_screen;
screen Next;
    label body "Next view";
    navigation goHome "Back" triggers OpenHome;
end_screen;
end_gui;
process OpenNext ()
    pre
        true
    post
        current_view = 1
end_process
process OpenHome ()
    pre
        true
    post
        current_view = 0
end_process
end_module
`,
    'utf-8'
  )

  writeFileSync(
    join(root, gui),
    `guispecVersion: "1.0"
meta:
  id: "${randomUUID()}"
  title: ${JSON.stringify(`${name} GUI`)}
  informalTarget: ./${informal}
gui:
  app:
    name: ${ident}App
    description: |
      Application views.
  screens:
    - id: view-home
      name: Home
      title: Home
      size:
        width: 640
        height: 400
      widgets:
        - id: w-title
          kind: label
          label: Welcome
          bounds: { x: 24, y: 24, width: 240, height: 32 }
        - id: w-open
          kind: navigation
          label: Open
          bounds: { x: 24, y: 72, width: 120, height: 32 }
          events:
            - on: click
              action: navigate
              targetView: view-next
    - id: view-next
      name: Next
      title: Next
      size:
        width: 640
        height: 400
      widgets:
        - id: w-next
          kind: label
          label: Next view
          bounds: { x: 24, y: 24, width: 240, height: 32 }
        - id: w-back
          kind: navigation
          label: Back
          bounds: { x: 24, y: 72, width: 120, height: 32 }
          events:
            - on: click
              action: navigate
              targetView: view-home
  flows:
    - from: view-home
      to: view-next
      on: navigate
      label: Open next
    - from: view-next
      to: view-home
      on: navigate
      label: Back home
`,
    'utf-8'
  )

  writeManifest(root, manifest)
  return manifest
}
