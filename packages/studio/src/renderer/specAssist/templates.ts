import type { InformalSuggestion } from './types'
import { nextId } from './ident'

export type InformalTemplateId = 'purpose' | 'module' | 'process' | 'data' | 'constraint'

export function informalTemplate(id: InformalTemplateId): InformalSuggestion {
  if (id === 'purpose') {
    return {
      id: 'tpl-purpose',
      title: 'purpose',
      kind: 'patch-aspec',
      patch: { action: 'patch-field', path: 'system.purpose', value: 'Describe the system purpose in natural language.\n' }
    }
  }
  if (id === 'module') {
    return {
      id: 'tpl-module',
      title: 'module',
      kind: 'patch-aspec',
      patch: {
        action: 'add-module',
        module: { id: nextId('mod'), name: 'NewModule', description: 'Describe this module.' }
      }
    }
  }
  if (id === 'process') {
    return {
      id: 'tpl-process',
      title: 'process',
      kind: 'patch-aspec',
      patch: {
        action: 'add-process',
        process: {
          id: nextId('f'),
          name: 'F_new',
          description: 'Describe the function in natural language.',
          scenarios: [
            { id: nextId('sc'), condition: 'typical case', outcome: 'the function succeeds' }
          ]
        }
      }
    }
  }
  if (id === 'data') {
    return {
      id: 'tpl-data',
      title: 'data',
      kind: 'patch-aspec',
      patch: {
        action: 'add-variable',
        variable: { id: nextId('d'), name: 'D_new', description: 'Describe this data item.' }
      }
    }
  }
  return {
    id: 'tpl-constraint',
    title: 'constraint',
    kind: 'patch-aspec',
    patch: {
      action: 'add-invariant',
      invariant: { id: nextId('c'), description: 'State a business constraint.', textHint: '' }
    }
  }
}
