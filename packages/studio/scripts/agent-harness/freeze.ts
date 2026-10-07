/** Provenance + freeze guard for experiment batches (no network, git only). */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const FREEZE_TAG = 'exp-freeze-v1.2'
/** Everything whose change could alter tool behaviour in a batch (harness scripts are recorded by hash instead). */
export const TOOL_PATHS = [
  'packages/parser/src', 'packages/studio/src', 'packages/editor-api/src', 'packages/aspec/src',
  'packages/gui/src', 'packages/language-server/src', 'package-lock.json',
  'packages/parser/package.json', 'packages/studio/package.json', 'packages/editor-api/package.json',
  'packages/aspec/package.json', 'packages/gui/package.json'
]
/** Workspace packages consumed through their built dist by the harness. */
export const DIST_PACKAGES = ['parser', 'aspec', 'editor-api', 'gui']

export type Git = (args: string[]) => string
// stderr is captured (not inherited) so Windows autocrlf notices ("LF will be replaced by CRLF") don't clutter the batch log
export const gitIn = (repo: string): Git => (args) => execFileSync('git', ['-c', `safe.directory=${repo.replace(/\\/g, '/')}`, ...args], { cwd: repo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

export interface FreezeStatus {
  ok: boolean
  head: string
  freezeTag: string
  freezeCommit: string | null
  changedToolFiles: string[]
  staleDist: string[]
  reasons: string[]
}

function newestMtime(dir: string): number {
  let m = 0
  if (!existsSync(dir)) return 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs)
  }
  return m
}

export function freezeStatus(repo: string, git: Git = gitIn(repo)): FreezeStatus {
  const reasons: string[] = []
  const head = git(['rev-parse', 'HEAD'])
  let freezeCommit: string | null = null
  try { freezeCommit = git(['rev-parse', `${FREEZE_TAG}^{commit}`]) } catch { reasons.push(`tag ${FREEZE_TAG} not found`) }
  let changed: string[] = []
  if (freezeCommit) {
    // working tree (committed + uncommitted) vs the freeze tag, plus untracked files, restricted to tool paths
    changed = [
      ...git(['diff', '--name-only', FREEZE_TAG, '--', ...TOOL_PATHS]).split('\n'),
      ...git(['ls-files', '--others', '--exclude-standard', '--', ...TOOL_PATHS]).split('\n')
    ].filter(Boolean)
    if (changed.length) reasons.push(`tool source differs from ${FREEZE_TAG} in ${changed.length} file(s)`)
  }
  const staleDist: string[] = []
  for (const p of DIST_PACKAGES) {
    const src = newestMtime(join(repo, 'packages', p, 'src')), dist = newestMtime(join(repo, 'packages', p, 'dist'))
    if (!dist || dist < src) staleDist.push(p)
  }
  if (staleDist.length) reasons.push(`dist older than src (rebuild): ${staleDist.join(', ')}`)
  return { ok: reasons.length === 0, head, freezeTag: FREEZE_TAG, freezeCommit, changedToolFiles: changed, staleDist, reasons }
}

/** sha256 over the harness scripts actually used (recorded in every manifest); CRLF is normalised so a
 *  Windows (autocrlf) copy hashes the same as the committed files. */
export function harnessSha(harnessDir: string): string {
  const h = createHash('sha256')
  for (const f of readdirSync(harnessDir).filter((x) => /\.(ts|mjs)$/.test(x)).sort()) h.update(f).update(readFileSync(join(harnessDir, f), 'utf-8').replace(/\r\n/g, '\n'))
  return h.digest('hex')
}

export const isInside = (child: string, parent: string) => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !/^[a-zA-Z]:/.test(rel))
}
