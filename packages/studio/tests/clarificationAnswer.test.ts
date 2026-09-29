import { describe, expect, it } from 'vitest'
import { continuationUserText } from '../src/main/services/llm/agentPatch'
import {
  composeClarificationAnswer,
  encodeClarificationAnswer,
  formatClarificationToolContent,
  mergeClarificationCustom
} from '../src/shared/clarificationAnswer'

const labels = ['储户', '柜员', '管理员']

describe('composeClarificationAnswer', () => {
  it('keeps a typed answer together with the clicked option on a single-choice question', () => {
    expect(
      composeClarificationAnswer({
        selectedLabels: ['储户'],
        custom: '夜间值班',
        multiSelect: false
      })
    ).toEqual({
      selected: ['储户'],
      custom: '夜间值班',
      answer: '储户; 夜间值班'
    })
  })

  it('keeps a typed answer when nothing was selected', () => {
    expect(
      composeClarificationAnswer({
        selectedLabels: [],
        custom: '只要自定义',
        multiSelect: false
      })
    ).toEqual({
      selected: [],
      custom: '只要自定义',
      answer: '只要自定义'
    })
  })
})

describe('formatClarificationToolContent', () => {
  it('puts custom on its own field for a single-choice answer that also has a selection', () => {
    const encoded = encodeClarificationAnswer(
      composeClarificationAnswer({
        selectedLabels: ['储户'],
        custom: '夜间值班',
        multiSelect: false
      })
    )
    const formatted = formatClarificationToolContent(encoded, { labels, multiSelect: false })
    const payload = JSON.parse(formatted.toolContent) as { selected: string[]; custom: string }
    expect(payload.selected).toEqual(['储户'])
    expect(payload.custom).toBe('夜间值班')
    expect(formatted.display).toBe('储户; 夜间值班')
    expect(continuationUserText(formatted.toolContent)).toContain('夜间值班')
    expect(continuationUserText(formatted.toolContent)).toMatch(/single-choice/)
  })

  it('treats a free-text reply as custom even when it does not match an option', () => {
    const formatted = formatClarificationToolContent('不要这三项，改成审计员', {
      labels,
      multiSelect: false
    })
    const payload = JSON.parse(formatted.toolContent) as { selected: string[]; custom: string }
    expect(payload.selected).toEqual([])
    expect(payload.custom).toBe('不要这三项，改成审计员')
    expect(continuationUserText(formatted.toolContent)).toContain('审计员')
  })

  it('appends composer text onto a card answer without dropping the selection', () => {
    const encoded = encodeClarificationAnswer(
      composeClarificationAnswer({ selectedLabels: ['柜员'], custom: '', multiSelect: false })
    )
    const merged = mergeClarificationCustom(encoded, '再加一个夜间窗口')
    const formatted = formatClarificationToolContent(merged, { labels, multiSelect: false })
    const payload = JSON.parse(formatted.toolContent) as { selected: string[]; custom: string }
    expect(payload.selected).toEqual(['柜员'])
    expect(payload.custom).toBe('再加一个夜间窗口')
  })
})
