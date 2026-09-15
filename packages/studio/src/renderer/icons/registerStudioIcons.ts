import { addIcon } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'
import hierarchySquare01 from './hugeicons-hierarchy-square-01.json'

const STUDIO_LUCIDE_ICONS = [
  'folder-plus',
  'folder-open',
  'send-horizontal',
  'chevron-left',
  'chevron-right',
  'shield',
  'maximize-2',
  'x'
] as const

export function registerStudioIcons(): void {
  const width = lucide.width ?? 24
  const height = lucide.height ?? 24
  for (const name of STUDIO_LUCIDE_ICONS) {
    const body = lucide.icons[name]
    if (!body) continue
    addIcon(`lucide:${name}`, { ...body, width, height })
  }
  addIcon('hugeicons:hierarchy-square-01', hierarchySquare01)
}
