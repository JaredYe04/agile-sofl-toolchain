import editorApiUrl from 'monaco-editor/esm/vs/editor/editor.api.js?url'

declare global {
  // Monaco ESM resolves dynamic worker imports against this root (see network.js).
  // eslint-disable-next-line no-var
  var _VSCODE_FILE_ROOT: string | undefined
}

const MARKER = '/vs/editor/editor.api.js'

function monacoEsmRootFromEditorApiUrl(url: string): string {
  const idx = url.lastIndexOf(MARKER)
  if (idx === -1) {
    throw new Error(`Monaco ESM root resolution failed for ${url}`)
  }
  return url.slice(0, idx)
}

export function installMonacoFileRoot(scope: typeof globalThis = globalThis): void {
  scope._VSCODE_FILE_ROOT = monacoEsmRootFromEditorApiUrl(editorApiUrl)
}

installMonacoFileRoot()
