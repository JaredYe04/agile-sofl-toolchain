import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parseAspec } from '../src/parse.js'
import { validateAspec } from '../src/validate.js'
import { buildInformalModel } from '../src/buildInformalModel.js'
import { refineToAsfl } from '../src/refine/refineToAsfl.js'
import { buildCoverageReport } from '../src/trace/coverage.js'
import { check } from '@agile-sofl/parser'
import { patchAspecField, patchFieldById, formatAspec, patchAspec } from '../src/patch.js'
import { validateBookAlign } from '../src/validateBookAlign.js'
import { mergeExistingAsfl } from '../src/refine/mergeAsfl.js'
import { attachDiagnosticLines } from '../src/sourceSpans.js'
import { buildFunctionBody } from '../src/refine/fsfBuilder.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('parseAspec', () => {
  it('parses minimal fixture', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const { document, diagnostics } = parseAspec(source)
    expect(diagnostics).toHaveLength(0)
    expect(document?.meta.title).toContain('Library')
    expect(document?.modules[0]?.processes?.[0]?.name).toBe('Borrow')
  })
})

describe('validateAspec', () => {
  it('passes style rules on minimal fixture', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const { document } = parseAspec(source)
    const diags = validateAspec(document!)
    expect(diags.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('refineToAsfl', () => {
  it('generates checkable asfl', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const { document } = parseAspec(source)
    const result = refineToAsfl(document!, source)
    expect(result.asflText).toContain('module SYSTEM_Library')
    expect(result.asflText).toContain('process Borrow')
    expect(result.asflText).toContain('aspec_proc_borrow')
    const checkResult = check(result.asflText)
    expect(checkResult.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('buildCoverageReport', () => {
  it('reports partial when asfl missing processes', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const report = buildCoverageReport(source, 'module SYSTEM_Empty;\nend_module\n')
    expect(report.missing).toBeGreaterThan(0)
  })
})

describe('library example pair', () => {
  it('refines library-informal.aspec to checkable asfl', () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
    const aspecPath = join(repoRoot, 'examples', 'library-informal.aspec')
    const source = readFileSync(aspecPath, 'utf8')
    const { document } = parseAspec(source)
    const result = refineToAsfl(document!, source, { aspecUri: aspecPath })
    const checkResult = check(result.asflText)
    expect(checkResult.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
    expect(result.asflText).toContain('module SYSTEM_Library')
    expect(result.asflText).toContain('process Borrow')
    const report = buildCoverageReport(source, result.asflText, result.traceability)
    expect(report.total).toBeGreaterThan(0)
    expect(report.percent).toBeGreaterThan(0)
  })
})

describe('patchAspecField', () => {
  it('updates system purpose', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const next = patchAspecField(source, 'system.purpose', 'Updated purpose')
    const model = buildInformalModel(next)
    expect(model.system.purpose).toBe('Updated purpose')
  })
})

describe('patchFieldById', () => {
  it('updates process description by stable id', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const next = patchFieldById(source, 'process.proc-borrow.description', 'New desc')
    const model = buildInformalModel(next)
    expect(model.modules[0]?.processes?.[0]?.description).toBe('New desc')
  })

  it('updates system.purpose via system kind path', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const next = patchFieldById(source, 'system.purpose', 'By id purpose')
    expect(buildInformalModel(next).system.purpose).toBe('By id purpose')
  })

  it('updates type typeHint by id', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const next = patchFieldById(source, 'type.type-book-id.typeHint', 'string')
    expect(buildInformalModel(next).modules[0]?.types?.[0]?.typeHint).toBe('string')
  })

  it('updates variable and invariant by id', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const nextVar = patchFieldById(source, 'var.var-books.typeHint', 'seq of nat')
    expect(buildInformalModel(nextVar).modules[0]?.variables?.[0]?.typeHint).toBe('seq of nat')
    const nextInv = patchFieldById(source, 'inv.inv-books.textHint', 'book_ids != {}')
    expect(buildInformalModel(nextInv).modules[0]?.invariants?.[0]?.textHint).toBe('book_ids != {}')
  })
})

describe('formatAspec', () => {
  it('re-serializes document with stable structure', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const formatted = formatAspec(source.replace(/\n/g, '\n\n'))
    const model = buildInformalModel(formatted)
    expect(model.system.name).toBe('Library')
    expect(model.modules[0]?.processes?.[0]?.name).toBe('Borrow')
  })
})

describe('patchAspec CRUD', () => {
  it('adds type via patchAspec action', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const next = patchAspec(source, {
      action: 'add-type',
      moduleId: 'mod-library',
      type: { id: 'type-member', name: 'MemberId', typeHint: 'nat' }
    })
    expect(buildInformalModel(next).modules[0]?.types?.some((t) => t.name === 'MemberId')).toBe(true)
  })
})

describe('buildFunctionBody', () => {
  it('uses bodyHint as informal when not bottom-level', () => {
    expect(buildFunctionBody({ bodyHint: 'return sum of inputs' })).toBe('informal return sum of inputs')
  })

  it('uses bodyHint literally when bottom-level and expression-like', () => {
    expect(buildFunctionBody({ bodyHint: 'x + y', refinementHints: { bottomLevel: true } })).toBe('x + y')
  })
})

describe('refine with pre/post/bodyHint', () => {
  it('includes preconditions in generated FSF', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const withPre = patchFieldById(source, 'process.proc-borrow.preconditions', 'member_id > 0')
    const { document } = parseAspec(withPre)
    const result = refineToAsfl(document!, withPre)
    expect(result.asflText).toContain('informal member_id > 0')
  })
})

describe('validateBookAlign', () => {
  it('warns when bookAlign data missing usedBy', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const { document } = parseAspec(source)
    const withBook = {
      ...document!,
      bookAlign: {
        data: [{ ref: 'D_1', description: 'shared data' }]
      }
    }
    const diags = validateBookAlign(withBook)
    expect(diags.some((d) => d.code === 'BOOK_ALIGN_002')).toBe(true)
  })
})

describe('mergeExistingAsfl', () => {
  it('preserves existing FSF when merge_fsf_only', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const { document } = parseAspec(source)
    const generated = refineToAsfl(document!, source).asflText
    const customized = generated.replace(
      'informal member and book ids are valid',
      'informal customized requirement'
    )
    const merged = mergeExistingAsfl(generated, customized, [
      { aspecId: 'proc-borrow', processName: 'Borrow', strategy: 'merge_fsf_only' }
    ])
    expect(merged).toContain('customized requirement')
    expect(check(merged).diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})

describe('attachDiagnosticLines', () => {
  it('adds line numbers for YAML paths', () => {
    const source = readFileSync(join(fixtures, 'minimal.aspec'), 'utf8')
    const diags = attachDiagnosticLines(source, [
      { code: 'TEST', message: 'm', severity: 'warning', path: 'system.purpose' }
    ])
    expect(diags[0]?.line).toBeGreaterThan(0)
  })
})
