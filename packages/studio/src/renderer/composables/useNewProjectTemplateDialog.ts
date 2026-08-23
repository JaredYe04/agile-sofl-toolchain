import { ref } from 'vue'
import { assetUrl } from '../lib/assetUrl'

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

export interface GroupedProjectTemplates {
  basic: ProjectTemplateEntry[]
  example: ProjectTemplateEntry[]
}

export function groupProjectTemplates(entries: ProjectTemplateEntry[]): GroupedProjectTemplates {
  const basic: ProjectTemplateEntry[] = []
  const example: ProjectTemplateEntry[] = []
  for (const entry of entries) {
    if (entry.category === 'example') example.push(entry)
    else basic.push(entry)
  }
  return { basic, example }
}

const open = ref(false)
let manifestCache: ProjectTemplateEntry[] | null = null

export function useNewProjectTemplateDialog() {
  async function loadManifest(): Promise<ProjectTemplateEntry[]> {
    if (manifestCache) return manifestCache
    const res = await fetch(assetUrl('/templates/project-manifest.json'))
    if (!res.ok) throw new Error('Failed to load project templates manifest')
    const data = (await res.json()) as { templates: ProjectTemplateEntry[] }
    manifestCache = data.templates
    return manifestCache
  }

  function show(): void {
    open.value = true
  }

  function hide(): void {
    open.value = false
  }

  return { open, loadManifest, show, hide }
}
