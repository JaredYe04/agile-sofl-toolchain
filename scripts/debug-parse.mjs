import { parse } from '../dist/index.js'

const cases = [
  ['numeric', 'module SYSTEM_E;\nconst v = 1 + 2 * 3;\nend_module'],
  ['setseq', 'module SYSTEM_E;\nconst s = {1, 2, 3};\nconst q = [1, 2];\nend_module'],
  ['inv', 'module SYSTEM_E;\nvar x: nat;\ninv x > 0 and x <> 10;\nend_module'],
  ['process', `module SYSTEM_P;
process P (x: int) y: nat
FSF :
x > 0 && y > 0 ||
others && y = 0
end_process
end_module`],
  ['ext', `module SYSTEM_P;
process P ()
ext
rd a: int
wr b: nat
FSF :
true && b = 1
end_process
end_module`],
  ['quant', 'module SYSTEM_E;\nvar customers: set of nat;\ninv forall[c: customers] | c.deposite > 0;\nend_module']
]

for (const [name, src] of cases) {
  const r = parse(src)
  const errors = r.diagnostics.filter((d) => d.severity === 'error')
  console.log(`\n=== ${name} (${errors.length} errors) ===`)
  for (const e of errors) console.log(` L${e.span.line}: ${e.message.slice(0, 90)}`)
}
