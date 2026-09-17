import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildVisualModelTolerant } from '../src/visualParse.js'
import {
  buildSpecMap,
  buildSpecMaps,
  isSpecMapKind,
  layoutSpecMap,
  structureModeFromChrome,
  type InformalMapInput,
  type GuiMapInput
} from '../src/specMaps/index.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../parser/tests/fixtures')

const nestedInformal: InformalMapInput = {
  sections: [
    {
      type: 'functions',
      children: [
        {
          id: 'fn-login',
          type: 'function',
          title: 'Login',
          children: [
            { id: 'fn-check', type: 'function', title: 'CheckPassword' },
            { id: 'fn-session', type: 'function', title: 'CreateSession' }
          ]
        }
      ]
    },
    {
      type: 'data-resources',
      children: [
        {
          id: 'dr-users',
          type: 'data-resource',
          title: 'Users',
          children: [{ id: 'df-id', type: 'data-field', title: 'userId' }]
        }
      ]
    }
  ]
}

const gui: GuiMapInput = {
  screens: [
    {
      id: 'home',
      name: 'Home',
      triggersProcess: 'Login',
      widgets: [{ id: 'go', nav: 'Cart' }]
    },
    { id: 'cart', name: 'Cart' }
  ],
  flows: [{ from: 'home', to: 'cart', on: 'click', label: 'Open cart' }]
}

describe('specMaps compilers', () => {
  it('returns empty maps without inventing topology', () => {
    const maps = buildSpecMaps({})
    expect(maps.architecture.emptyReason).toBe('no-specification')
    expect(maps.architecture.nodes).toEqual([])
    expect(maps.workflow.emptyReason).toBe('no-process-flow')
    expect(maps.sequence.emptyReason).toBe('no-gui-flows')
    expect(maps.dataflow.emptyReason).toBe('no-data-flow')
    expect(maps.lifecycle.emptyReason).toBe('no-lifecycle-states')
  })

  it('builds informal architecture, workflow, dataflow, and sequence from nested functions', () => {
    const maps = buildSpecMaps({ informal: nestedInformal })
    expect(maps.architecture.nodes.some((n) => n.label === 'Login')).toBe(true)
    expect(maps.architecture.nodes.some((n) => n.label === 'Users' && n.kind === 'database')).toBe(true)
    expect(maps.workflow.edges.some((e) => e.from.includes('fn-login') && e.to.includes('fn-check'))).toBe(true)
    expect(maps.dataflow.nodes.some((n) => n.label === 'userId')).toBe(true)
    expect(maps.sequence.nodes.some((n) => n.label === 'User')).toBe(true)
    expect(maps.sequence.edges.length).toBeGreaterThan(0)
  })

  it('builds hybrid architecture and dataflow from authored modules and ext', () => {
    const source = readFileSync(join(fixtures, 'grammar/processes/ext-alias.asfl'), 'utf8')
    const visual = buildVisualModelTolerant(source)
    const maps = buildSpecMaps({ hybrid: { modules: visual.modules, fsfModels: visual.fsfModels } })
    expect(maps.architecture.nodes.some((n) => n.kind === 'backend')).toBe(true)
    expect(maps.dataflow.edges.some((e) => e.kind === 'read' || e.kind === 'write')).toBe(true)
    expect(maps.workflow.nodes.length + maps.lifecycle.nodes.length).toBeGreaterThan(0)
  })

  it('builds architecture from multi-module parent edges', () => {
    const source = readFileSync(join(fixtures, 'grammar/modules/multi-module.asfl'), 'utf8')
    const visual = buildVisualModelTolerant(source)
    const map = buildSpecMap('architecture', { hybrid: { modules: visual.modules } })
    expect(map.nodes.length).toBeGreaterThanOrEqual(3)
    expect(map.edges.some((e) => e.kind === 'parent')).toBe(true)
    expect(map.emptyReason).toBeUndefined()
  })

  it('builds GUI sequence and lifecycle from flows without inventing extra screens', () => {
    const maps = buildSpecMaps({ gui })
    expect(maps.sequence.nodes.map((n) => n.label)).toEqual(expect.arrayContaining(['Home', 'Cart', 'Login']))
    expect(maps.sequence.edges.some((e) => e.kind === 'nav')).toBe(true)
    expect(maps.sequence.edges.some((e) => e.kind === 'call')).toBe(true)
    expect(maps.lifecycle.nodes.some((n) => n.kind === 'start')).toBe(true)
    expect(maps.lifecycle.edges.length).toBeGreaterThan(0)
  })

  it('does not treat a flat informal function list as workflow', () => {
    const map = buildSpecMap('workflow', {
      informal: {
        sections: [{ type: 'functions', children: [{ id: 'fn-a', type: 'function', title: 'Only' }] }]
      }
    })
    expect(map.emptyReason).toBe('no-process-flow')
    expect(map.nodes).toEqual([])
  })
})

describe('specMaps layout', () => {
  it('places sequence participants and messages on a finite bbox', () => {
    const map = buildSpecMap('sequence', { gui })
    const layout = layoutSpecMap(map)
    expect(layout.nodes.length).toBe(map.nodes.length)
    expect(layout.lifelines.length).toBe(map.nodes.length)
    expect(layout.bbox.maxX).toBeGreaterThan(layout.bbox.minX)
    expect(layout.edges.every((e) => e.y1 === e.y2)).toBe(true)
  })

  it('lays out architecture without overlapping identical origins', () => {
    const source = readFileSync(join(fixtures, 'grammar/modules/multi-module.asfl'), 'utf8')
    const visual = buildVisualModelTolerant(source)
    const layout = layoutSpecMap(buildSpecMap('architecture', { hybrid: { modules: visual.modules } }))
    const keys = layout.nodes.map((n) => `${n.x},${n.y}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('structureModeFromChrome', () => {
  it('keeps the current map kind when switching back to Maps', () => {
    expect(structureModeFromChrome('tree', 'workflow')).toBe('tree')
    expect(structureModeFromChrome('map', 'workflow')).toBe('workflow')
    expect(structureModeFromChrome('graph', 'tree')).toBe('architecture')
    expect(isSpecMapKind('dataflow')).toBe(true)
    expect(isSpecMapKind('graph')).toBe(false)
  })
})
