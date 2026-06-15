import { stringify } from 'yaml'
import type { AspecDocument } from './model.js'

export function serializeAspec(document: AspecDocument): string {
  return stringify(document, { lineWidth: 0 })
}
