import { describe, expect, it } from 'vitest'
import { informalToMapInput, toSpecMapSource } from '../src/renderer/lib/specMapSource'
import { buildSpecMap, structureModeFromChrome } from '@agile-sofl/editor-api'
import type { InformalSpecPayload } from '../src/preload/index'

const spec: InformalSpecPayload = {
  id: 'spec',
  moduleId: 'App',
  version: 1,
  metadata: {},
  sections: [
    {
      id: 'functions',
      type: 'functions',
      title: 'Functions',
      children: [
        {
          id: 'fn-login',
          type: 'function',
          title: 'Login',
          children: [],
          metadata: {
            nested: [
              { id: 'fn-check', type: 'function', title: 'CheckPassword', children: [] }
            ]
          }
        }
      ]
    }
  ]
}

describe('specMapSource', () => {
  it('maps informal nested metadata into compiler input', () => {
    const input = informalToMapInput(spec)
    expect(input?.sections[0]?.children[0]?.children?.[0]?.title).toBe('CheckPassword')
    const workflow = buildSpecMap('workflow', toSpecMapSource({ informal: spec }))
    expect(workflow.emptyReason).toBeUndefined()
    expect(workflow.edges.length).toBeGreaterThan(0)
  })

  it('maps chrome tree/map onto structure modes', () => {
    expect(structureModeFromChrome('map', 'tree')).toBe('architecture')
    expect(structureModeFromChrome('map', 'lifecycle')).toBe('lifecycle')
    expect(structureModeFromChrome('tree', 'sequence')).toBe('tree')
  })
})
