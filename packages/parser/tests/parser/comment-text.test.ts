import { describe, expect, it } from 'vitest'
import { parse } from '../../src/index.js'
import { textOf } from '../../src/ast/nodes.js'

const wrap = (body: string) => `module SYSTEM_TestModule;
process P ()
${body}
end_process
end_module`

describe('comment text', () => {
  it('parses Chinese in comment', () => {
    const { ast, diagnostics } = parse(wrap('comment: 门诊挂号测试'))
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    const proc = ast!.modules.find((m) => m.name === 'TestModule')!.processes[0]
    expect(textOf(proc.body?.comment)).toContain('门诊')
  })

  it('parses numbers in comment', () => {
    const { ast, diagnostics } = parse(wrap('comment: step 123 done'))
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    const proc = ast!.modules.find((m) => m.name === 'TestModule')!.processes[0]
    expect(textOf(proc.body?.comment)).toContain('123')
  })

  it('parses quoted Chinese in comment', () => {
    const { ast, diagnostics } = parse(wrap('comment: "quoted 中文"'))
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(textOf(ast!.modules.find((m) => m.name === 'TestModule')!.processes[0].body?.comment)).toContain('中文')
  })
})
