import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'
import { useDocumentStore } from '../../stores/document'
import { filePathsEqual } from '../../stores/tabUtils'

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

function resolveSearchRoot(ctx: CommandCenterContext): string | null {
  const tab = ctx.activeTab
  if (tab?.filePath) {
    const parts = tab.filePath.split(/[/\\]/)
    parts.pop()
    return parts.join('/') || null
  }
  const recent = ctx.recentFiles[0]
  if (recent?.path) {
    const parts = recent.path.split(/[/\\]/)
    parts.pop()
    return parts.join('/') || null
  }
  return null
}

export const projectFilesProvider: CommandCenterProvider = {
  id: 'project-files',
  prefix: '',
  priority: 30,
  query(query, ctx) {
    if (!query || query.length < 2) return []
    if (!window.studio?.searchWorkspaceFiles) return []

    const rootDir = resolveSearchRoot(ctx)
    if (!rootDir) return []

    return window.studio.searchWorkspaceFiles(rootDir, query).then((files) => {
      const doc = useDocumentStore()
      const openTabs = ctx.documentTabs.filter((t) => t.filePath)
      const items: CommandCenterItem[] = []

      for (const file of files) {
        if (openTabs.some((t) => t.filePath && filePathsEqual(t.filePath!, file.path))) continue
        items.push({
          id: `proj:${file.path}`,
          kind: 'file',
          label: basename(file.path),
          detail: file.path,
          group: 'commandCenter.group.projectFiles',
          score: 25,
          execute: async () => {
            const existing = doc.documentTabs.find(
              (t) => t.filePath && filePathsEqual(t.filePath, file.path)
            )
            if (existing) {
              doc.setActive(existing.id)
              return
            }
            const result = await window.studio!.fileRead(file.path)
            doc.openFromFile(result.filePath, result.content, result.title)
          }
        })
      }
      return items
    })
  }
}
