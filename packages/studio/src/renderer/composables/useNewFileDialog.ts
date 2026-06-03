import { ref } from 'vue'

export interface TemplateEntry {
  id: string
  titleKey: string
  descriptionKey: string
  file: string
  category: string
}

const open = ref(false)
let manifestCache: TemplateEntry[] | null = null

export function useNewFileDialog() {
  async function loadManifest(): Promise<TemplateEntry[]> {
    if (manifestCache) return manifestCache
    const res = await fetch('/templates/manifest.json')
    if (!res.ok) throw new Error('Failed to load templates manifest')
    const data = (await res.json()) as { templates: TemplateEntry[] }
    manifestCache = data.templates
    return manifestCache
  }

  async function loadTemplateContent(file: string): Promise<string> {
    const res = await fetch(`/templates/${file}`)
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
