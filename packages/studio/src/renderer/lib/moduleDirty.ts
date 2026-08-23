export function dirtyModuleNames(
  modules: Array<{ name: string; filePath: string }>,
  saved: Record<string, Record<string, string>>,
  current: Record<string, Record<string, string>>
): string[] {
  const dirty: string[] = []
  for (const mod of modules) {
    const prev = saved[mod.filePath]?.[mod.name]
    const next = current[mod.filePath]?.[mod.name]
    if (prev && next && prev !== next) dirty.push(mod.name)
    if (!prev && next) dirty.push(mod.name)
  }
  return dirty
}
