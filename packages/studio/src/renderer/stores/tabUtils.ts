export type TabKind = 'home' | 'document'
export type DocumentKind = 'asfl' | 'aspec'

export const HOME_TAB_ID = 'studio-home'

export interface EditorTab {
  id: string
  kind: TabKind
  documentKind: DocumentKind
  filePath: string | null
  uri: string
  title: string
  isDirty: boolean
  content: string
  linkedDocumentId?: string
}

let untitledCounter = 1

export function createUntitledTitle(kind: DocumentKind = 'asfl'): string {
  return kind === 'aspec' ? `Untitled-${untitledCounter++}.aspec` : `Untitled-${untitledCounter++}`
}

export function inferDocumentKind(filePath: string | null, uri?: string): DocumentKind {
  if (filePath?.toLowerCase().endsWith('.aspec')) return 'aspec'
  if (uri?.includes('.aspec')) return 'aspec'
  return 'asfl'
}

export function defaultContentForKind(kind: DocumentKind): string {
  if (kind === 'aspec') {
    return `aspecVersion: "1.0"
meta:
  id: "${crypto.randomUUID()}"
  title: New Informal Spec
system:
  name: NewSystem
  purpose: |
    Describe the system purpose here.
modules:
  - id: mod-main
    name: SYSTEM_New
    description: |
      Main system module.
`
  }
  return 'module SYSTEM_New;\nend_module\n'
}

export function createHomeTab(): EditorTab {
  return {
    id: HOME_TAB_ID,
    kind: 'home',
    documentKind: 'asfl',
    filePath: null,
    uri: 'studio://home',
    title: 'Home',
    isDirty: false,
    content: ''
  }
}

export function tabUriForPath(filePath: string | null, id: string, kind: DocumentKind = 'asfl'): string {
  if (filePath) {
    return pathToFileUri(filePath)
  }
  const ext = kind === 'aspec' ? 'aspec' : 'asfl'
  return `inmemory://studio/${id}.${ext}`
}

export function normalizeFilePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) normalized = normalized[0].toLowerCase() + normalized.slice(1)
  else if (normalized.startsWith('/')) normalized = normalized.toLowerCase()
  return normalized
}

export function filePathsEqual(a: string, b: string): boolean {
  return normalizeFilePath(a) === normalizeFilePath(b)
}

export function pathToFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return `file:///${normalized}`
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

export function createDocumentTab(partial?: Partial<EditorTab>): EditorTab {
  const id = partial?.id ?? crypto.randomUUID()
  const documentKind = partial?.documentKind ?? inferDocumentKind(partial?.filePath ?? null, partial?.uri)
  const title = partial?.title ?? createUntitledTitle(documentKind)
  const filePath = partial?.filePath ?? null
  return {
    id,
    kind: 'document',
    documentKind,
    filePath,
    uri: partial?.uri ?? tabUriForPath(filePath, id, documentKind),
    title,
    isDirty: partial?.isDirty ?? false,
    content: partial?.content ?? defaultContentForKind(documentKind),
    linkedDocumentId: partial?.linkedDocumentId
  }
}

/** @deprecated use createDocumentTab */
export function createTab(partial?: Partial<EditorTab>): EditorTab {
  return createDocumentTab(partial)
}
