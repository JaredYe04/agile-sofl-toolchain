export type TabKind = 'home' | 'document'

export const HOME_TAB_ID = 'studio-home'

export interface EditorTab {
  id: string
  kind: TabKind
  filePath: string | null
  uri: string
  title: string
  isDirty: boolean
  content: string
}

let untitledCounter = 1

export function createUntitledTitle(): string {
  return `Untitled-${untitledCounter++}`
}

export function createHomeTab(): EditorTab {
  return {
    id: HOME_TAB_ID,
    kind: 'home',
    filePath: null,
    uri: 'studio://home',
    title: 'Home',
    isDirty: false,
    content: ''
  }
}

export function tabUriForPath(filePath: string | null, id: string): string {
  if (filePath) {
    return pathToFileUri(filePath)
  }
  return `inmemory://studio/${id}.asfl`
}

export function pathToFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return `file:///${normalized}`
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

export function createDocumentTab(partial?: Partial<EditorTab>): EditorTab {
  const id = partial?.id ?? crypto.randomUUID()
  const title = partial?.title ?? createUntitledTitle()
  const filePath = partial?.filePath ?? null
  return {
    id,
    kind: 'document',
    filePath,
    uri: partial?.uri ?? tabUriForPath(filePath, id),
    title,
    isDirty: partial?.isDirty ?? false,
    content: partial?.content ?? 'module SYSTEM_New;\nend_module\n'
  }
}

/** @deprecated use createDocumentTab */
export function createTab(partial?: Partial<EditorTab>): EditorTab {
  return createDocumentTab(partial)
}
