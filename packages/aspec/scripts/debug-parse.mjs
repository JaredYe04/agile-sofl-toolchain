import { parse } from '@agile-sofl/parser'
import { readFileSync } from 'fs'
import { parseAspec } from '../dist/parse.js'
import { refineToAsfl } from '../dist/refine/refineToAsfl.js'

const s = readFileSync('./tests/fixtures/minimal.aspec', 'utf8')
const { document } = parseAspec(s)
const r = refineToAsfl(document, s)
const lines = r.asflText.split('\n')

for (let i = lines.length; i >= 5; i--) {
  const partial = lines.slice(0, i).join('\n')
  const diags = parse(partial).diagnostics.filter((d) => d.severity === 'error')
  if (diags.length) {
    console.log('FAIL at line', i, ':', lines[i - 1])
    console.log(diags[0]?.message)
    break
  }
}

console.log('FULL TEXT:\n', r.asflText)
