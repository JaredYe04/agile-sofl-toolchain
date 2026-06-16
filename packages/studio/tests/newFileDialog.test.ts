import { describe, it, expect } from 'vitest'
import {
  groupTemplates,
  inferDocumentKind,
  isBlankTemplate,
  type TemplateEntry
} from '../src/renderer/composables/useNewFileDialog'

const sampleManifest: TemplateEntry[] = [
  {
    id: 'blank',
    titleKey: 'template.blank.title',
    descriptionKey: 'template.blank.description',
    file: 'blank.asfl',
    category: 'basic',
    kind: 'blank'
  },
  {
    id: 'library-system',
    titleKey: 'template.library.title',
    descriptionKey: 'template.library.description',
    file: 'library-system.asfl',
    category: 'example'
  },
  {
    id: 'informal-blank',
    titleKey: 'template.informal.blank.title',
    descriptionKey: 'template.informal.blank.description',
    file: 'informal-blank.aspec',
    category: 'informal',
    kind: 'blank'
  },
  {
    id: 'library-informal',
    titleKey: 'template.informal.library.title',
    descriptionKey: 'template.informal.library.description',
    file: 'library-informal.aspec',
    category: 'informal'
  },
  {
    id: 'gui-blank',
    titleKey: 'template.gui.blank.title',
    descriptionKey: 'template.gui.blank.description',
    file: 'informal-blank.guispec',
    category: 'gui',
    kind: 'blank'
  },
  {
    id: 'library-gui',
    titleKey: 'template.gui.library.title',
    descriptionKey: 'template.gui.library.description',
    file: 'library-gui.guispec',
    category: 'gui'
  }
]

describe('useNewFileDialog helpers', () => {
  it('infers document kind from file extension', () => {
    expect(inferDocumentKind('x.asfl')).toBe('asfl')
    expect(inferDocumentKind('x.aspec')).toBe('aspec')
    expect(inferDocumentKind('x.guispec')).toBe('guispec')
  })

  it('detects blank templates by id or kind', () => {
    expect(isBlankTemplate(sampleManifest[0]!)).toBe(true)
    expect(isBlankTemplate(sampleManifest[1]!)).toBe(false)
    expect(isBlankTemplate(sampleManifest[4]!)).toBe(true)
  })

  it('groups templates into blanks and example sections', () => {
    const grouped = groupTemplates(sampleManifest)
    expect(grouped.blanks.map((e) => e.id)).toEqual(['blank', 'informal-blank', 'gui-blank'])
    expect(grouped.asfl.map((e) => e.id)).toEqual(['library-system'])
    expect(grouped.informal.map((e) => e.id)).toEqual(['library-informal'])
    expect(grouped.gui.map((e) => e.id)).toEqual(['library-gui'])
  })
})
