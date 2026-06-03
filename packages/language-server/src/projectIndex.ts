/**
 * LSP-facing wrapper around library ProjectIndex.
 */

import { ProjectIndex } from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'

let index = new ProjectIndex()

/** @internal */
export function getLspProjectIndex(): ProjectIndex {
  return index
}

/** @internal test helper */
export function resetLspProjectIndex(): void {
  index = new ProjectIndex()
}

export function syncDocument(document: TextDocument): void {
  index.upsert(document.uri, document.getText())
}

export function removeDocument(uri: string): void {
  index.remove(uri)
}

export function scanWorkspaceRoot(rootDir: string): void {
  index.scan(rootDir)
}
