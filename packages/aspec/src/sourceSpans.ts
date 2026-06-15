import type { AspecDiagnostic } from './model.js'

function lineStartOffsets(source: string): number[] {
  const offsets: number[] = [0]
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') offsets.push(i + 1)
  }
  return offsets
}

export function offsetAtLine(source: string, line: number, column = 1): number {
  const offsets = lineStartOffsets(source)
  const idx = Math.max(0, Math.min(line - 1, offsets.length - 1))
  return offsets[idx]! + Math.max(0, column - 1)
}

function findLineForPath(source: string, path: string): { line: number; column: number } | null {
  const segments = path.split('.')
  const last = segments[segments.length - 1]!
  const lines = source.split(/\r?\n/)

  if (last.startsWith('proc-') || last.startsWith('mod-') || last.startsWith('scen-')) {
    const idPattern = new RegExp(`^\\s*id:\\s*["']?${escapeRegex(last)}["']?\\s*$`)
    for (let i = 0; i < lines.length; i++) {
      if (idPattern.test(lines[i]!)) return { line: i + 1, column: 1 }
    }
  }

  const keyPattern = new RegExp(`^\\s*${escapeRegex(last)}\\s*:`)
  for (let i = 0; i < lines.length; i++) {
    if (keyPattern.test(lines[i]!)) return { line: i + 1, column: 1 }
  }

  return null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function attachDiagnosticLines(source: string, diagnostics: AspecDiagnostic[]): AspecDiagnostic[] {
  return diagnostics.map((d) => {
    if (d.line != null) return d
    if (!d.path) return d
    const loc = findLineForPath(source, d.path)
    return loc ? { ...d, line: loc.line, column: loc.column } : d
  })
}
