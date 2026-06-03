#!/usr/bin/env node
/**
 * Assert monorepo module boundaries: product packages must not import sibling product src.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const packagesDir = join(repoRoot, 'packages')

const PRODUCT_PACKAGES = new Set(['vscode', 'studio'])

const IMPORT_RE =
  /(?:import\s+(?:[\s\S]*?\sfrom\s+)?|export\s+(?:[\s\S]*?\sfrom\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g

function listSourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-electron') continue
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx|js|mjs|vue)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function packageName(folder) {
  if (folder === 'vscode') return 'agile-sofl (vscode)'
  return `@agile-sofl/${folder}`
}

const violations = []

for (const folder of readdirSync(packagesDir)) {
  if (!PRODUCT_PACKAGES.has(folder)) continue
  const srcDir = join(packagesDir, folder, 'src')
  if (!statSync(srcDir).isDirectory()) continue

  for (const file of listSourceFiles(srcDir)) {
    const text = readFileSync(file, 'utf8')
    let match
    while ((match = IMPORT_RE.exec(text)) !== null) {
      const spec = match[1]
      if (!spec.startsWith('.') && !spec.startsWith('..')) continue

      const resolved = join(file, '..', spec).replace(/\\/g, '/')
      for (const other of PRODUCT_PACKAGES) {
        if (other === folder) continue
        const otherSrc = join(packagesDir, other, 'src').replace(/\\/g, '/')
        if (resolved.includes(otherSrc)) {
          violations.push({
            pkg: packageName(folder),
            file: relative(repoRoot, file),
            import: spec,
            target: packageName(other)
          })
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Module boundary violations:')
  for (const v of violations) {
    console.error(`  ${v.pkg}: ${v.file} imports "${v.import}" (${v.target} src)`)
  }
  process.exit(1)
}

console.log('Module boundaries OK')
