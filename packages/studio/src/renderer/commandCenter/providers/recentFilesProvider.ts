import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'
import { useDocumentStore } from '../../stores/document'
import { filePathsEqual } from '../../stores/tabUtils'

function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] ?? path
}

export const recentFilesProvider: CommandCenterProvider = {
  id: 'recent-files',
  prefix: '',
  priority: 20,
  query(query, ctx) {
    const doc = useDocumentStore()
    const needle = query.toLowerCase()
    const openTabs = ctx.documentTabs.filter((t) => t.filePath)
    const items: CommandCenterItem[] = []

    for (const recent of ctx.recentFiles) {
      if (openTabs.some((t) => t.filePath && filePathsEqual(t.filePath!, recent.path))) continue
      const label = recent.title || basename(recent.path)
      if (needle && !label.toLowerCase().includes(needle) && !recent.path.toLowerCase().includes(needle)) {
        continue
      }
      items.push({
        id: `recent:${recent.path}`,
        kind: 'file',
        label,
        detail: recent.path,
        group: 'commandCenter.group.recentFiles',
        score: 30,
        execute: async () => {
          const existing = doc.documentTabs.find(
            (t) => t.filePath && filePathsEqual(t.filePath, recent.path)
          )
          if (existing) {
            doc.setActive(existing.id)
            return
          }
          const result = await window.studio!.fileRead(recent.path)
          doc.openFromFile(result.filePath, result.content, result.title)
        }
      })
    }

    if (!needle) {
      items.push({
        id: 'action:open-file',
        kind: 'command',
        label: ctx.t('commandCenter.openFileAction'),
        group: 'commandCenter.group.actions',
        score: 5,
        execute: (ctx) => ctx.openFile()
      })
    }

    return items
  }
}
