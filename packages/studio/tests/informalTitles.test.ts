import { describe, expect, it } from 'vitest'
import { duplicateTitle, nextIndexedTitle } from '../src/renderer/lib/informalTitles'

describe('informalTitles', () => {
  it('allocates the next unused index', () => {
    expect(nextIndexedTitle([], '功能')).toBe('功能1')
    expect(nextIndexedTitle(['功能1', '功能3'], '功能')).toBe('功能2')
    expect(nextIndexedTitle(['数据源1'], '数据源')).toBe('数据源2')
  })

  it('appends a copy suffix', () => {
    expect(duplicateTitle('功能1', ' 副本')).toBe('功能1 副本')
  })
})
