#!/usr/bin/env node
/**
 * Prepare exp-freeze-v1.2 worktree and install this runner into it.
 *
 *   node packages/studio/scripts/case-study-sim/prepare.mjs [--dir <path>] [--skip-install]
 *
 * Wraps scripts/agent-harness/prepare-v12.mjs (does not replace the classroom batch),
 * then copies case-study-sim and builds .harness/case-study-sim.mjs on the freeze tree.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const harnessPrepare = join(here, '..', 'agent-harness', 'prepare-v12.mjs')
const argv = process.argv.slice(2)
const result = spawnSync(process.execPath, [harnessPrepare, ...argv], { stdio: 'inherit' })
if (result.status) process.exit(result.status ?? 1)

const di = argv.indexOf('--dir')
const repoTop = spawnSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], {
  cwd: here,
  encoding: 'utf-8'
}).stdout.trim()
const wt = resolve(di >= 0 ? argv[di + 1] : join(repoTop, '..', 'agile-sofl-toolchain-v12'))
const dst = join(wt, 'packages', 'studio', 'scripts', 'case-study-sim')
mkdirSync(dst, { recursive: true })

function copyTree(src, out) {
  mkdirSync(out, { recursive: true })
  for (const name of readdirSync(src)) {
    if (name === 'node_modules') continue
    const from = join(src, name)
    const to = join(out, name)
    if (statSync(from).isDirectory()) copyTree(from, to)
    else cpSync(from, to)
  }
}
copyTree(here, dst)
if (!existsSync(join(wt, 'packages', 'studio'))) {
  console.error(`worktree missing studio package: ${wt}`)
  process.exit(2)
}
const build = spawnSync(process.execPath, [join(dst, 'build.mjs')], {
  cwd: join(wt, 'packages', 'studio'),
  stdio: 'inherit'
})
if (build.status) process.exit(build.status ?? 1)
console.log(`\ncase-study-sim ready on freeze worktree: ${wt}`)
console.log(`  cd "${join(wt, 'packages', 'studio')}"`)
console.log('  node .harness/case-study-sim.mjs --help')
console.log('  node .harness/case-study-sim.mjs --dry-run --pilot')
console.log('  node .harness/case-study-sim.mjs --pilot')
