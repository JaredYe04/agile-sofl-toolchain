import { parse } from '../dist/index.js'

for (const [name, src] of [
  ['dup', `module SYSTEM_A;\nend_module;\nmodule SYSTEM_A;\nend_module`],
  ['fsf', `module SYSTEM_P;\nprocess P ()\nFSF :\ninformal text && y = 1\nend_process\nend_module`]
]) {
  const r = parse(src)
  console.log(`\n=== ${name} ===`)
  for (const e of r.diagnostics.filter((d) => d.severity === 'error')) {
    console.log(`L${e.span.line}: ${e.message.slice(0, 100)}`)
  }
}
