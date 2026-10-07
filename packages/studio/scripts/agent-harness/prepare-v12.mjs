#!/usr/bin/env node
/**
 * Prepare a git worktree of exp-freeze-v1.2 for experiment batches, with the CURRENT harness scripts.
 *
 *   node packages/studio/scripts/agent-harness/prepare-v12.mjs [--dir <path>] [--skip-install]
 *
 * 1. `git worktree add --detach <dir> exp-freeze-v1.2` (default <repo>/../agile-sofl-toolchain-v12);
 *    an existing worktree must be at the tag commit.
 * 2. Copies packages/studio/scripts/agent-harness/* and the system informal fixtures into it
 *    (harness scripts are not tool source; the batch records their sha256).
 * 3. `npm ci`, builds parser, gui, aspec, editor-api, language-server, then the harness bundle.
 * 4. Writes .harness/v12-origin.json with the path of THIS checkout's packages/studio/.env, so the API key
 *    is read in place by the batch and never copied.
 * Prints the launch command. Makes no LLM calls.
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TAG = 'exp-freeze-v1.2'
const here = dirname(fileURLToPath(import.meta.url))
const repo = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf-8' }).trim()
const argv = process.argv.slice(2)
const di = argv.indexOf('--dir')
const wt = resolve(di >= 0 ? argv[di + 1] : join(repo, '..', 'agile-sofl-toolchain-v12'))
const git = (cwd, ...a) => execFileSync('git', ['-c', `safe.directory=${cwd.replace(/\\/g, '/')}`, ...a], { cwd, encoding: 'utf-8' }).trim()
const sh = (cmd, cwd) => { console.log(`> ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }) }

const tagCommit = git(repo, 'rev-parse', `${TAG}^{commit}`)
if (!existsSync(wt)) git(repo, 'worktree', 'add', '--detach', wt, TAG)
const head = git(wt, 'rev-parse', 'HEAD')
if (head !== tagCommit) { console.error(`worktree ${wt} is at ${head}, expected ${TAG} = ${tagCommit}`); process.exit(2) }

const dstHarness = join(wt, 'packages', 'studio', 'scripts', 'agent-harness')
mkdirSync(dstHarness, { recursive: true })
for (const f of readdirSync(here)) copyFileSync(join(here, f), join(dstHarness, f))
const fx = join('packages', 'parser', 'tests', 'fixtures', 'reference-systems')
for (const f of ['classroom.aspec', 'delivery-trimmed.aspec']) copyFileSync(join(repo, fx, f), join(wt, fx, f))

if (!argv.includes('--skip-install')) sh('npm ci --no-audit --no-fund', wt)
for (const w of ['@agile-sofl/parser', '@agile-sofl/gui', '@agile-sofl/aspec', '@agile-sofl/editor-api', '@agile-sofl/language-server']) sh(`npm run build --workspace ${w}`, wt)
sh('node scripts/agent-harness/build.mjs', join(wt, 'packages', 'studio'))
mkdirSync(join(wt, 'packages', 'studio', '.harness'), { recursive: true })
writeFileSync(join(wt, 'packages', 'studio', '.harness', 'v12-origin.json'),
  JSON.stringify({ originRepo: repo, envFile: join(repo, 'packages', 'studio', '.env'), tag: TAG, tagCommit }, null, 2))
console.log(`\nv1.2 worktree ready: ${wt} (HEAD ${tagCommit})`)
console.log(`  cd "${join(wt, 'packages', 'studio')}"`)
console.log('  node .harness/batch.mjs --dry-run --repeats 1                                          # no LLM calls')
console.log('  node .harness/batch.mjs --systems classroom,delivery --conditions T,B2,B0-auto --repeats 5   # real batch')
