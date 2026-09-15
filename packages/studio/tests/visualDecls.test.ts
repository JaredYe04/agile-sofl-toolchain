import { describe, expect, it } from 'vitest'
import {
  composedTypeText,
  nextFieldName,
  parseVarText,
  varDeclText
} from '../src/renderer/lib/visualDecls'

describe('visualDecls', () => {
  it('composes type text from fields', () => {
    expect(composedTypeText('Account', [{ name: 'id', type: 'string' }, { name: 'balance', type: 'nat' }])).toBe(
      'Account = composed of id: string balance: nat end'
    )
  })

  it('fills a default field when composing an empty list', () => {
    expect(composedTypeText('Empty', [])).toBe('Empty = composed of field_1: nat end')
  })

  it('parses variable declarations', () => {
    expect(parseVarText('salary: nat;')).toEqual({ name: 'salary', type: 'nat' })
    expect(varDeclText('x', 'int')).toBe('x: int')
  })

  it('allocates the next field name', () => {
    expect(nextFieldName([{ name: 'field_1', type: 'nat' }])).toBe('field_2')
  })
})
