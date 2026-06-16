#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const pm = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm'

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

function buildWorkspace(pkg) {
  if (pm === 'pnpm') {
    run(`pnpm --filter ${pkg} build`)
  } else {
    run(`npm run build --workspace ${pkg}`)
  }
}

function bundleWorkspace(pkg) {
  if (pm === 'pnpm') {
    run(`pnpm --filter ${pkg} bundle`)
  } else {
    run(`npm run bundle --workspace ${pkg}`)
  }
}

const deps = [
  '@agile-sofl/parser',
  '@agile-sofl/gui',
  '@agile-sofl/aspec',
  '@agile-sofl/editor-api'
]

for (const pkg of deps) {
  buildWorkspace(pkg)
}

bundleWorkspace('@agile-sofl/language-server')
