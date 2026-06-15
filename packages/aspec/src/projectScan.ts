import { readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { ProjectScanResult, ProjectPair } from './model.js'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])
const YIELD_EVERY = 32

function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : '.'
}

async function walk(
  dir: string,
  ext: string,
  out: string[],
  counter: { n: number }
): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = await stat(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      counter.n++
      if (counter.n % YIELD_EVERY === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
      await walk(full, ext, out, counter)
    } else if (name.endsWith(ext)) {
      out.push(full)
    }
  }
}

export async function scanProject(root: string): Promise<ProjectScanResult> {
  const counter = { n: 0 }
  const aspecFiles: string[] = []
  const asflFiles: string[] = []
  await walk(root, '.aspec', aspecFiles, counter)
  await walk(root, '.asfl', asflFiles, counter)

  const pairs: ProjectPair[] = aspecFiles.map((aspecPath) => {
    const base = basename(aspecPath, '.aspec')
    const tracePath = join(dirname(aspecPath), `${base}.aspec.trace.json`)
    const candidateAsfl = asflFiles.find((p) => basename(p, '.asfl') === base.replace(/-informal$/, ''))
    return {
      aspecPath,
      asflPath: candidateAsfl,
      tracePath
    }
  })

  return { root, aspecFiles, asflFiles, pairs }
}
