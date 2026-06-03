import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_ROOT = join(__dirname, '..', 'fixtures')

export function loadFixture(relativePath: string): string {
  return readFileSync(join(FIXTURES_ROOT, relativePath), 'utf-8')
}

export { astEqual, stripSpans } from '../../src/transform/normalize'

export function expectParseOk(source: string, parseFn: (s: string) => { ast: unknown; diagnostics: { severity: string; code: string }[] }) {
  const { ast, diagnostics } = parseFn(source)
  const errors = diagnostics.filter((d) => d.severity === 'error')
  if (errors.length > 0) {
    throw new Error(`Parse errors: ${errors.map((e) => e.code).join(', ')}`)
  }
  if (!ast) throw new Error('Expected AST but got null')
  return ast
}

export function expectDiagnostic(
  diagnostics: { code: string }[],
  code: string
): boolean {
  return diagnostics.some((d) => d.code === code)
}
