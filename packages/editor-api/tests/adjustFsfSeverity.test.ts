import { describe, it, expect } from 'vitest'
import { adjustFsfDiagnosticSeverity } from '../src/mergeDiagnostics.js'

describe('adjustFsfDiagnosticSeverity', () => {
  it('promotes FSF_INFORMAL_BOTTOM to error in strict mode', () => {
    const diags = [{ code: 'ASFL_FSF_001', severity: 'warning', message: 'x' }]
    const adjusted = adjustFsfDiagnosticSeverity(diags, true)
    expect(adjusted[0]?.severity).toBe('error')
  })

  it('leaves severity unchanged when not strict', () => {
    const diags = [{ code: 'ASFL_FSF_001', severity: 'warning', message: 'x' }]
    expect(adjustFsfDiagnosticSeverity(diags, false)[0]?.severity).toBe('warning')
  })
})
