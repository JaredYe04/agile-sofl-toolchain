import { describe, it, expect } from 'vitest'
import {
  groupProjectTemplates,
  type ProjectTemplateEntry
} from '../src/renderer/composables/useNewProjectTemplateDialog'

const sampleManifest: ProjectTemplateEntry[] = [
  {
    id: 'blank',
    titleKey: 'template.project.blank.title',
    descriptionKey: 'template.project.blank.description',
    category: 'basic',
    useEmptyProject: true
  },
  {
    id: 'minimal',
    titleKey: 'template.minimal.title',
    descriptionKey: 'template.minimal.description',
    category: 'basic',
    hybrid: ['minimal-module.asfl']
  },
  {
    id: 'library',
    titleKey: 'template.library.title',
    descriptionKey: 'template.library.description',
    category: 'example',
    informal: 'library-informal.aspec',
    hybrid: ['library-system.asfl'],
    gui: 'library-gui.guispec'
  }
]

describe('useNewProjectTemplateDialog helpers', () => {
  it('groups templates into basic and example sections', () => {
    const grouped = groupProjectTemplates(sampleManifest)
    expect(grouped.basic.map((e) => e.id)).toEqual(['blank', 'minimal'])
    expect(grouped.example.map((e) => e.id)).toEqual(['library'])
  })
})
