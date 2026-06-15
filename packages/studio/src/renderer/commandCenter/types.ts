import type { RevealSpanFn } from '../composables/useCodeNavigation'
import type { RecentFile } from '../stores/recentFiles'
import type { EditorTab } from '../stores/tabUtils'
import type { SerializableSpan } from '../../preload/index'

export type CommandCenterItemKind =
  | 'file'
  | 'tab'
  | 'symbol'
  | 'command'
  | 'diagnostic'
  | 'help'

export interface CommandCenterItem {
  id: string
  kind: CommandCenterItemKind
  label: string
  detail?: string
  badge?: string
  score?: number
  group?: string
  execute: (ctx: CommandCenterContext) => void | Promise<void>
}

export interface CommandCenterContext {
  activeTab: EditorTab | null
  documentTabs: EditorTab[]
  recentFiles: RecentFile[]
  revealSpan: RevealSpanFn
  formatDocument: () => Promise<boolean>
  undoRedo: (cmd: 'undo' | 'redo') => boolean
  runEdit: (cmd: string) => void
  openNewFile: () => void
  openFile: () => Promise<void>
  saveTab: () => Promise<boolean>
  saveAsTab: () => Promise<boolean>
  closeActiveTab: () => Promise<void>
  openDevTools: () => void
  t: (key: string, params?: Record<string, unknown>) => string
}

export interface CommandCenterProvider {
  id: string
  /** Empty string = default quick-open mode */
  prefix?: string
  priority: number
  isEnabled?: (ctx: CommandCenterContext) => boolean
  query: (
    query: string,
    ctx: CommandCenterContext
  ) => CommandCenterItem[] | Promise<CommandCenterItem[]>
}

export interface BuiltinCommand {
  id: string
  titleKey: string
  detailKey?: string
  when?: (ctx: CommandCenterContext) => boolean
  run: (ctx: CommandCenterContext) => void | Promise<void>
}

export type ProjectSymbolResult = {
  uri: string
  name: string
  kind: string
  moduleName: string
  span: SerializableSpan
  containerName?: string
}

export function parseCommandQuery(raw: string): { prefix: string; query: string } {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('@')) return { prefix: '@', query: trimmed.slice(1).trim() }
  if (trimmed.startsWith('>')) return { prefix: '>', query: trimmed.slice(1).trim() }
  if (trimmed.startsWith(':')) return { prefix: ':', query: trimmed.slice(1).trim() }
  if (trimmed.startsWith('!')) return { prefix: '!', query: trimmed.slice(1).trim() }
  if (trimmed.startsWith('?')) return { prefix: '?', query: trimmed.slice(1).trim() }
  if (trimmed.startsWith('#')) return { prefix: '#', query: trimmed.slice(1).trim() }
  return { prefix: '', query: raw.trim() }
}

export function fileUriToPath(uri: string): string | null {
  if (uri.startsWith('inmemory://') || uri.startsWith('studio://')) return null
  try {
    const u = new URL(uri)
    if (u.protocol !== 'file:') return null
    let p = decodeURIComponent(u.pathname)
    if (p.startsWith('/') && /^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
    return p
  } catch {
    return null
  }
}
