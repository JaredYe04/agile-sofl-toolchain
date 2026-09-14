import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { toIpcValue } from '../src/renderer/lib/toIpcValue'

describe('toIpcValue', () => {
  it('strips Vue proxies so structuredClone succeeds', () => {
    const ctx = reactive({
      permissions: {
        informal: { read: true, write: false },
        hybrid: { read: true, write: true }
      },
      promptExtras: '## 生成参数'
    })
    expect(() => structuredClone(ctx)).toThrow(/could not be cloned/)
    const plain = toIpcValue(ctx)
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain.permissions.hybrid.write).toBe(true)
    expect(plain.promptExtras).toBe('## 生成参数')
  })
})
