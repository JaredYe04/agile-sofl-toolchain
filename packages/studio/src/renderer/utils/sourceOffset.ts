export function offsetAtLine(source: string, line: number, column = 1): number {
  const offsets: number[] = [0]
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') offsets.push(i + 1)
  }
  const idx = Math.max(0, Math.min(line - 1, offsets.length - 1))
  return offsets[idx]! + Math.max(0, column - 1)
}
