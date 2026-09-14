import { describe, expect, it } from 'vitest'
import { check } from '@agile-sofl/parser'
import { parseInformalSpec, informalToHybridIR, irToGenerationResult, createLlmHybridGenerator, defaultHybridGenerateParams } from '../src/index.js'

const ATM = `# Functions

## Withdraw from the bank account

The system shall allow a customer to withdraw money.

### Input

- Account number
- Amount

### Result

Cash or an error message.

# Data Resources

## Bank Account

### Account Number

Unique account id.

### Account Balance

Current balance.

# Constraints

## Non-negative Balance

The account balance cannot be less than 0.
`

describe('informalToHybridIR', () => {
  it('maps ATM informal into types, processes, and pre/post rather than FSF source', () => {
    const { specification } = parseInformalSpec(ATM)
    expect(specification).toBeTruthy()
    const ir = informalToHybridIR(specification!)
    expect(ir.types.some((t) => t.name.includes('Bank') || t.name.includes('Account'))).toBe(true)
    expect(ir.processes.some((p) => p.name.includes('Withdraw'))).toBe(true)
    const result = irToGenerationResult(specification!, ir)
    expect(result.asflText).toContain('pre')
    expect(result.asflText).toContain('post')
    expect(result.asflText).not.toMatch(/FSF\s*:/)
    expect(result.changes?.length).toBeGreaterThan(0)
    const errors = check(result.asflText).diagnostics.filter((d) => d.severity === 'error')
    expect(errors).toHaveLength(0)
  })

  it('filters IR by selected process ids', () => {
    const { specification } = parseInformalSpec(ATM)
    const ir = informalToHybridIR(specification!)
    const result = irToGenerationResult(specification!, ir, {
      selectedNodeIds: ir.processes.slice(0, 1).map((p) => p.informalId ?? `proc-${p.name}`)
    })
    expect(result.specification.processes.length).toBeLessThanOrEqual(ir.processes.length)
    expect(check(result.asflText).diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('filters types when stages.typesVars is false', () => {
    const { specification } = parseInformalSpec(ATM)
    const ir = informalToHybridIR(specification!)
    const result = irToGenerationResult(specification!, ir, {
      params: {
        stages: {
          hybridSpec: false,
          modules: true,
          processes: true,
          scenarios: true,
          typesVars: false,
          invariants: true
        },
        detailLevel: 2,
        strategy: 'merge',
        inferUnstatedDesign: true,
        moduleSplit: 'single-system'
      }
    })
    expect(result.specification.types).toHaveLength(0)
    expect(result.specification.variables).toHaveLength(0)
    expect(result.specification.processes.length).toBeGreaterThan(0)
  })
})

describe('defaultHybridGenerateParams', () => {
  it('defaults toward detailed output including GUI views', () => {
    const params = defaultHybridGenerateParams('zh-CN')
    expect(params.detailLevel).toBe(3)
    expect(params.stages.gui).toBe(true)
  })
})

describe('llm-baseline agent bootstrap', () => {
  it('declares agent runtime and returns hybrid-generation bootstrap', () => {
    const { specification } = parseInformalSpec(ATM)
    const gen = createLlmHybridGenerator(async () => '{}')
    expect(gen.runtime).toBe('agent')
    const bootstrap = gen.agentBootstrap?.({
      input: specification!,
      params: defaultHybridGenerateParams('zh-CN'),
      context: {}
    })
    expect(bootstrap?.skillId).toBe('hybrid-generation')
    expect(bootstrap?.permissions.hybrid.write).toBe(true)
    expect(bootstrap?.permissions.informal.write).toBe(false)
    expect(bootstrap?.promptExtras).toContain('生成参数')
  })
})
