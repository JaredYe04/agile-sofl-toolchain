import { ref } from 'vue'
import { assetUrl } from '../lib/assetUrl'
import type { DocumentKind } from '../stores/tabUtils'

export interface TemplateEntry {
  id: string
  titleKey: string
  descriptionKey: string
  file: string
  category: string
  kind?: 'blank' | 'example'
}

export const BLANK_TEMPLATE_IDS = new Set(['blank', 'informal-blank', 'gui-blank'])

export interface GroupedTemplates {
  blanks: TemplateEntry[]
  asfl: TemplateEntry[]
  informal: TemplateEntry[]
  gui: TemplateEntry[]
}

export function isBlankTemplate(entry: TemplateEntry): boolean {
  return entry.kind === 'blank' || BLANK_TEMPLATE_IDS.has(entry.id)
}

export function inferDocumentKind(file: string): DocumentKind {
  if (file.endsWith('.aspec')) return 'aspec'
  if (file.endsWith('.guispec')) return 'guispec'
  return 'asfl'
}

export function fileExtensionLabel(file: string): string {
  if (file.endsWith('.guispec')) return '.guispec'
  if (file.endsWith('.aspec')) return '.aspec'
  return '.asfl'
}

export function groupTemplates(entries: TemplateEntry[]): GroupedTemplates {
  const blanks: TemplateEntry[] = []
  const asfl: TemplateEntry[] = []
  const informal: TemplateEntry[] = []
  const gui: TemplateEntry[] = []

  for (const entry of entries) {
    if (isBlankTemplate(entry)) {
      blanks.push(entry)
      continue
    }
    if (entry.file.endsWith('.guispec')) {
      gui.push(entry)
    } else if (entry.file.endsWith('.aspec')) {
      informal.push(entry)
    } else {
      asfl.push(entry)
    }
  }

  const blankOrder = ['blank', 'informal-blank', 'gui-blank']
  blanks.sort((a, b) => blankOrder.indexOf(a.id) - blankOrder.indexOf(b.id))

  return { blanks, asfl, informal, gui }
}

const open = ref(false)
let manifestCache: TemplateEntry[] | null = null

export function useNewFileDialog() {
  async function loadManifest(): Promise<TemplateEntry[]> {
    if (manifestCache) return manifestCache
    const res = await fetch(assetUrl('/templates/manifest.json'))
    if (!res.ok) throw new Error('Failed to load templates manifest')
    const data = (await res.json()) as { templates: TemplateEntry[] }
    manifestCache = data.templates
    return manifestCache
  }

  async function loadTemplateContent(file: string): Promise<string> {
    const res = await fetch(assetUrl(`/templates/${file}`))
    if (!res.ok) throw new Error(`Failed to load template: ${file}`)
    return res.text()
  }

  function show(): void {
    open.value = true
  }

  function hide(): void {
    open.value = false
  }

  return { open, loadManifest, loadTemplateContent, show, hide }
}
