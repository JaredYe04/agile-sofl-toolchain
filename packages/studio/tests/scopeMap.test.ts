import { describe, it, expect } from 'vitest'
import { scopeToColorClass, scopeToMonacoToken, mergeScopeMap } from '../src/renderer/monaco/scopeMap'

const scopeMap = mergeScopeMap({
  default: 'plain',
  rules: [
    { prefix: 'keyword.control', colorClass: 'kwCtrl' },
    { prefix: 'keyword.declaration', colorClass: 'kwDecl' },
    { prefix: 'entity.name.namespace', colorClass: 'module' }
  ]
})

describe('scope map', () => {
  it('maps keyword.control.asfl to kwCtrl', () => {
    expect(scopeToColorClass(['source.asfl', 'keyword.control.asfl'], scopeMap)).toBe('kwCtrl')
  })

  it('maps to monaco theme token string', () => {
    const token = scopeToMonacoToken(['source.asfl', 'keyword.declaration.asfl'], scopeMap)
    expect(token).toBe('keyword.declaration.asfl')
  })

  it('returns empty string for plain unmapped scopes', () => {
    expect(scopeToMonacoToken([], scopeMap)).toBe('')
  })
})
