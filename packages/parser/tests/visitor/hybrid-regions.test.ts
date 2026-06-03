import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, collectHybridRegions, walk } from '../../src/index'
import type { HybridRegion } from '../../src/visitor/walk'
import { isProgramNode } from '../../src/ast/guards'

const bankingFixture = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'integration',
  'banking.asfl'
)

function regionsOfType(regions: HybridRegion[], type: HybridRegion['type']): HybridRegion[] {
  return regions.filter((r) => r.type === type)
}

describe('collectHybridRegions', () => {
  it('collects FSF, comment, and decom from banking fixture', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    expect(isProgramNode(ast)).toBe(true)
    const regions = collectHybridRegions(ast!)
    const fsf = regionsOfType(regions, 'fsf')
    const comments = regionsOfType(regions, 'comment')
    const decoms = regionsOfType(regions, 'decom')

    expect(fsf).toHaveLength(1)
    expect(fsf[0].moduleName).toBe('Banking')
    expect(fsf[0].processName).toBe('A')
    expect(source.slice(fsf[0].span.start, fsf[0].span.end)).toContain('x > y')

    expect(decoms).toHaveLength(1)
    expect(decoms[0].processName).toBe('A')
    expect(source.slice(decoms[0].span.start, decoms[0].span.end)).toContain('Banking_Decom')

    expect(comments).toHaveLength(1)
    expect(comments[0].processName).toBe('A')
    expect(source.slice(comments[0].span.start, comments[0].span.end)).toContain('informal')
  })

  it('collects informal text inside FSF', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const { ast } = parse(source)
    expect(isProgramNode(ast)).toBe(true)
    const regions = collectHybridRegions(ast!)
    const informal = regionsOfType(regions, 'informal')
    expect(informal).toHaveLength(1)
    expect(informal[0].moduleName).toBe('P')
    expect(informal[0].processName).toBe('P')
    expect(source.slice(informal[0].span.start, informal[0].span.end)).toContain('informal')
  })

  it('tracks module and process ownership across multiple regions', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    const regions = collectHybridRegions(ast!)
    for (const region of regions) {
      expect(region.moduleName).toBe('Banking')
      expect(region.processName).toBe('A')
      expect(region.functionName).toBeUndefined()
    }
  })

  it('invokes visitor hooks for process body and ext vars', () => {
    const source = `module SYSTEM_E;
process P ()
ext
rd a: int
FSF :
true && true
end_process
end_module`
    const { ast } = parse(source)
    expect(isProgramNode(ast)).toBe(true)
    const bodies: string[] = []
    const extNames: string[] = []
    walk(ast!, {
      enterProcessBody() {
        bodies.push('body')
      },
      enterExtVar(ext) {
        extNames.push(ext.name)
      }
    })
    expect(bodies).toHaveLength(1)
    expect(extNames).toEqual(['a'])
  })
})
