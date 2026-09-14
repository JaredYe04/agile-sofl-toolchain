import { parse } from '@agile-sofl/parser'
import type { ProjectModuleInfo, ProjectModuleMember } from './projectTypes'

export function isGuiModuleName(
  mod: { name: string; gui?: unknown },
  guiModule?: string
): boolean {
  if (guiModule && (mod.name === guiModule || `GUI_${mod.name}` === guiModule)) return true
  if (mod.name.startsWith('GUI_')) return true
  if (mod.name.toLowerCase() === 'gui') return true
  return Boolean(mod.gui)
}

export function moduleDisplayName(mod: { name: string; isSystem: boolean }): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

function clip(text: string, n = 40): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  if (compact.length <= n) return compact
  return `${compact.slice(0, Math.max(0, n - 1))}…`
}

function named(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

/** Parse modules from in-memory source (partial AST still contributes modules). */
export function modulesFromSource(
  source: string,
  filePath: string,
  guiModule?: string
): ProjectModuleInfo[] {
  const { ast } = parse(source)
  const mods = ast?.type === 'program' ? ast.modules : []
  return mods
    .filter((mod) => named(mod.name))
    .map((mod) => {
      const members: ProjectModuleMember[] = []
      for (const c of mod.consts) {
        if (!named(c.name)) continue
        members.push({ kind: 'const', name: c.name, spanStart: c.span.start, spanEnd: c.span.end })
      }
      for (const t of mod.types) {
        if (!named(t.name)) continue
        members.push({ kind: 'type', name: t.name, spanStart: t.span.start, spanEnd: t.span.end })
      }
      for (const v of mod.vars) {
        if (!named(v.variable.name)) continue
        members.push({
          kind: 'var',
          name: v.variable.name,
          spanStart: v.span.start,
          spanEnd: v.span.end
        })
      }
      for (const inv of mod.invariants) {
        const label = clip(source.slice(inv.span.start, inv.span.end))
        if (!label) continue
        members.push({ kind: 'inv', name: label, spanStart: inv.span.start, spanEnd: inv.span.end })
      }
      for (const p of mod.processes) {
        if (!named(p.name)) continue
        members.push({ kind: 'process', name: p.name, spanStart: p.span.start, spanEnd: p.span.end })
      }
      for (const f of mod.functions) {
        if (!named(f.name)) continue
        members.push({ kind: 'function', name: f.name, spanStart: f.span.start, spanEnd: f.span.end })
      }
      if (mod.gui) {
        for (const screen of mod.gui.screens) {
          if (!named(screen.name)) continue
          members.push({
            kind: 'gui-screen',
            name: screen.name,
            spanStart: screen.span.start,
            spanEnd: screen.span.end
          })
        }
      }
      return {
        name: mod.name,
        displayName: moduleDisplayName(mod),
        filePath,
        isSystem: mod.isSystem,
        isGui: isGuiModuleName(mod, guiModule),
        parentName: mod.parent?.name,
        spanStart: mod.span.start,
        spanEnd: mod.span.end,
        members
      }
    })
}

function filePathsEqual(a: string, b: string): boolean {
  const norm = (p: string) => {
    let n = p.replace(/\\/g, '/')
    if (/^[a-zA-Z]:/.test(n)) n = n[0]!.toLowerCase() + n.slice(1)
    return n
  }
  return norm(a) === norm(b)
}

export function overlayModulesForFile(
  existing: ProjectModuleInfo[],
  filePath: string,
  next: ProjectModuleInfo[],
  options?: { keepPreviousIfEmpty?: boolean }
): ProjectModuleInfo[] {
  if (options?.keepPreviousIfEmpty && next.length === 0) {
    const prev = existing.filter((m) => filePathsEqual(m.filePath, filePath))
    if (prev.length > 0) return existing
  }
  const keep = existing.filter((m) => !filePathsEqual(m.filePath, filePath))
  return [...keep, ...next]
}
