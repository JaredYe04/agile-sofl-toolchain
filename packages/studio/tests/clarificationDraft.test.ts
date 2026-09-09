import { describe, expect, it } from 'vitest'
import { toggleClarificationDraft } from '../src/renderer/components/workspace/agent/clarificationDraft'

const source = {
  options: [
    { id: 'opt-a', label: '储户' },
    { id: 'opt-b', label: '柜员' },
    { id: 'opt-c', label: '管理员' }
  ],
  answer: '储户; 柜员'
}

describe('toggleClarificationDraft', () => {
  it('adds an unselected option in multi-select', () => {
    expect(toggleClarificationDraft({ ...source, multiSelect: true }, 'opt-c')).toEqual({
      ids: ['opt-a', 'opt-b', 'opt-c'],
      custom: ''
    })
  })

  it('removes an already selected option in multi-select', () => {
    expect(toggleClarificationDraft({ ...source, multiSelect: true }, 'opt-a')).toEqual({
      ids: ['opt-b'],
      custom: ''
    })
  })

  it('replaces the selection in single-select', () => {
    expect(toggleClarificationDraft({ ...source, multiSelect: false }, 'opt-c')).toEqual({
      ids: ['opt-c'],
      custom: ''
    })
  })

  it('clears a selected single-select option', () => {
    expect(toggleClarificationDraft({ ...source, answer: '储户' }, 'opt-a')).toEqual({
      ids: [],
      custom: ''
    })
  })

  it('keeps custom text when toggling options', () => {
    expect(
      toggleClarificationDraft({ ...source, multiSelect: true, answer: '储户; 夜间值班' }, 'opt-b')
    ).toEqual({
      ids: ['opt-a', 'opt-b'],
      custom: '夜间值班'
    })
  })
})
