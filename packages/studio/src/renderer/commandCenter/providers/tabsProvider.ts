import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'
import { useDocumentStore } from '../../stores/document'

function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] ?? path
}

export const tabsProvider: CommandCenterProvider = {
  id: 'tabs',
  prefix: '',
  priority: 10,
  query(query, ctx) {
    const doc = useDocumentStore()
    const needle = query.toLowerCase()
    const items: CommandCenterItem[] = []

    for (const tab of ctx.documentTabs) {
      const label = tab.filePath ? basename(tab.filePath) : tab.title
      const detail = tab.filePath ?? tab.title
      if (needle && !label.toLowerCase().includes(needle) && !detail.toLowerCase().includes(needle)) continue

      const isActive = tab.id === doc.activeTabId
      items.push({
        id: `tab:${tab.id}`,
        kind: 'tab',
        label: `${label}${tab.isDirty ? ' ●' : ''}`,
        detail,
        group: 'commandCenter.group.openTabs',
        score: isActive ? 100 : 50,
        execute: () => {
          doc.setActive(tab.id)
        }
      })
    }

    return items
  }
}
