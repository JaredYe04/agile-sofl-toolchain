#!/usr/bin/env node
/**
 * Studio subject runner launcher.
 * Builds the bundle, then runs it with packages/studio as the working directory.
 * API keys are never printed.
 *
 *   node packages/studio/scripts/studio-subjects/studio-subjects.mjs --help
 *   node packages/studio/scripts/studio-subjects/studio-subjects.mjs --dry-run --subjects P4
 */
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const studio = join(here, '..', '..')
const PATH_FLAGS = new Set(['out', 'env-file'])

export function argvForStudio(argv, cwd = process.cwd()) {
  const out = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    out.push(arg)
    if (!arg.startsWith('--') || !PATH_FLAGS.has(arg.slice(2))) continue
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) continue
    out.push(isAbsolute(value) ? value : resolve(cwd, value))
    i++
  }
  return out
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const build = spawnSync(process.execPath, [join(here, 'build.mjs')], { cwd: studio, stdio: 'inherit' })
  if (build.error) {
    console.error(build.error.message)
    process.exit(1)
  }
  if (build.status !== 0) process.exit(build.status ?? 1)
  const run = spawnSync(
    process.execPath,
    [join(studio, '.harness', 'studio-subjects.mjs'), ...argvForStudio(process.argv.slice(2))],
    {
      cwd: studio,
      stdio: 'inherit',
      env: {
        ...process.env,
        AGILE_SOFL_STUDIO_DIR: studio,
        AGILE_SOFL_STUDIO_SUBJECTS_DIR: here
      }
    }
  )
  if (run.error) {
    console.error(run.error.message)
    process.exit(1)
  }
  process.exit(run.status ?? 1)
}
