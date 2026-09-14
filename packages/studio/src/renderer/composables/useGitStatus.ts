import { reactive } from 'vue'

export type GitFileStatus =
  | 'untracked'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'conflicted'
  | 'ignored'
  | 'renamed'

export interface GitFileEntry {
  path: string
  status: GitFileStatus
}

export interface GitRootSnapshot {
  isRepo: boolean
  files: GitFileEntry[]
}

type StudioGitApi = {
  gitStatus?: (rootPath: string) => Promise<{ isRepo: boolean; files: GitFileEntry[] }>
  gitInit?: (rootPath: string) => Promise<{ ok: boolean; error?: string }>
  gitIsRepo?: (rootPath: string) => Promise<boolean>
}

const RANK: Record<GitFileStatus, number> = {
  conflicted: 0,
  deleted: 1,
  modified: 2,
  renamed: 3,
  added: 4,
  untracked: 5,
  ignored: 6
}

export const gitState = reactive<{
  byRoot: Record<string, GitRootSnapshot>
}>({
  byRoot: {}
})

const inflight = new Map<string, Promise<void>>()

function studioGit(): StudioGitApi | undefined {
  return window.studio as StudioGitApi | undefined
}

function toForward(p: string): string {
  return p.replace(/\\/g, '/')
}

export function relativeToProject(rootPath: string, filePath: string): string {
  const root = toForward(rootPath).replace(/\/+$/, '')
  const file = toForward(filePath)
  const r = root.toLowerCase()
  const f = file.toLowerCase()
  if (f === r) return ''
  if (f.startsWith(r + '/')) return file.slice(root.length + 1)
  return file.replace(/^\.\//, '')
}

function lookupStatus(snap: GitRootSnapshot, relPath: string): GitFileStatus | null {
  const needle = toForward(relPath).replace(/^\.\//, '')
  const needleLc = needle.toLowerCase()
  let best: GitFileStatus | null = null
  for (const file of snap.files) {
    const p = toForward(file.path)
    if (p !== needle && p.toLowerCase() !== needleLc) continue
    if (!best || RANK[file.status] < RANK[best]) best = file.status
  }
  return best
}

export function aggregateGitStatus(statuses: GitFileStatus[]): GitFileStatus | null {
  const relevant = statuses.filter((s) => s !== 'ignored')
  if (relevant.some((s) => s === 'conflicted')) return 'conflicted'
  if (relevant.some((s) => s === 'deleted')) return 'deleted'
  if (relevant.some((s) => s === 'modified' || s === 'renamed')) return 'modified'
  if (relevant.some((s) => s === 'added' || s === 'untracked')) {
    return relevant.some((s) => s === 'added') ? 'added' : 'untracked'
  }
  return null
}

export function isRepo(rootPath: string): boolean {
  return gitState.byRoot[rootPath]?.isRepo === true
}

export function statusForModule(rootPath: string, filePath: string): GitFileStatus | null {
  const snap = gitState.byRoot[rootPath]
  if (!snap?.isRepo || !filePath) return null
  return lookupStatus(snap, relativeToProject(rootPath, filePath))
}

export function statusForProject(rootPath: string): GitFileStatus | null {
  const snap = gitState.byRoot[rootPath]
  if (!snap?.isRepo) return null
  return aggregateGitStatus(snap.files.map((f) => f.status))
}

export function gitStatusClass(status: GitFileStatus | null | undefined): string {
  if (!status || status === 'ignored') return ''
  return `git-status-${status}`
}

export async function refreshGitFor(root: string): Promise<void> {
  if (!root) return
  const existing = inflight.get(root)
  if (existing) return existing
  const run = (async () => {
    try {
      const result = await studioGit()?.gitStatus?.(root)
      gitState.byRoot[root] = result ?? { isRepo: false, files: [] }
    } catch {
      gitState.byRoot[root] = { isRepo: false, files: [] }
    }
  })().finally(() => {
    inflight.delete(root)
  })
  inflight.set(root, run)
  return run
}

export function useGitStatus() {
  return {
    gitState,
    isRepo,
    refreshGitFor,
    statusForModule,
    statusForProject,
    gitStatusClass,
    classForModule(rootPath: string, filePath: string): string {
      return gitStatusClass(statusForModule(rootPath, filePath))
    },
    classForProject(rootPath: string): string {
      return gitStatusClass(statusForProject(rootPath))
    }
  }
}
