import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseGuiSpec } from '../dist/parse.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const dirs = [
  join(root, 'packages', 'studio', 'assets', 'templates'),
  join(root, 'packages', 'studio', 'public', 'templates'),
  join(root, 'examples')
]

let n = 0
for (const dir of dirs) {
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.guispec')) continue
    const from = join(dir, name)
    const to = join(dir, name.replace(/\.guispec$/, '.gui.html'))
    const parsed = parseGuiSpec(readFileSync(from, 'utf8'))
    if (!parsed.document?.html) {
      console.warn(`skip ${from}`)
      continue
    }
    writeFileSync(to, parsed.document.html, 'utf8')
    n++
    console.log(to)
  }
}
console.log(`wrote ${n} .gui.html files`)
