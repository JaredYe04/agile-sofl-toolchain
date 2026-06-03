export interface EditorTab {
  id: string
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

export function tabUriForPath(filePath: string | null, id: string): string {
  if (filePath) {
    const normalized = filePath.replace(/\\/g, '/')
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
  }
  return `inmemory://studio/${id}.asfl`
}

export function pathToFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return `file:///${normalized}`
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

export function createTab(partial?: Partial<EditorTab>): EditorTab {
  const id = partial?.id ?? crypto.randomUUID()
  const title = partial?.title ?? createUntitledTitle()
  const filePath = partial?.filePath ?? null
  return {
    id,
    filePath,
    uri: partial?.uri ?? tabUriForPath(filePath, id),
    title,
    isDirty: partial?.isDirty ?? false,
    content: partial?.content ?? 'module SYSTEM_New;\nend_module\n'
  }
}
