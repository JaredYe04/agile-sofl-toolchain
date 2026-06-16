#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(studioRoot, '../..')
const platform = process.argv[2]

if (!platform || !['win', 'mac', 'linux'].includes(platform)) {
  console.error('Usage: node scripts/run-electron-builder.mjs <win|mac|linux>')
  process.exit(1)
}

const electronBuilderBin = join(
  studioRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
)
const fallbackBin = join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder')
const bin = existsSync(electronBuilderBin) ? electronBuilderBin : fallbackBin

const args = [`--${platform}`, '--config', 'electron-builder.yml']
const result = spawnSync(bin, args, {
  cwd: studioRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ELECTRON_BUILDER_NODE_MODULES_ROOT: repoRoot
  }
})

process.exit(result.status ?? 1)
