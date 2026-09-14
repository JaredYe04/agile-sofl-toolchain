import type { FsfModelDto, FsfScenarioDto } from './fsfModel.js'
import {
  formatHybridId,
  namesEqual,
  uniqueSlug
} from './hybridIds.js'
import { buildVisualModelTolerant, type VisualModelResult } from './visualParse.js'

function clip(text: string, n: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= n) return compact
  return `${compact.slice(0, Math.max(0, n - 1))}…`
}

function processScenarios(
  fsfModels: FsfModelDto[],
  moduleName: string,
  processName: string
): FsfScenarioDto[] {
  const model = fsfModels.find(
    (m) =>
      !m.functionName &&
      m.processName === processName &&
      namesEqual(m.moduleName ?? '', moduleName)
  )
  if (!model) return []
  const listed = [...model.scenarios]
  for (const extra of model.exceptionalScenarios ?? []) {
    if (!listed.some((s) => s.id === extra.id)) listed.push(extra)
  }
  return listed
}

function scenarioLabel(scenario: FsfScenarioDto, indexInKind: number): string {
  const named = scenario.name?.trim()
  if (named) return named
  if (scenario.kind === 'exceptional') return `Exceptional${indexInKind}`
  return indexInKind === 1 ? 'Success' : `Success${indexInKind}`
}

function formatModuleInventory(model: VisualModelResult, mod: VisualModelResult['modules'][0]): string[] {
  const lines: string[] = []
  const role = mod.isSystem ? ' system' : mod.parentName ? ` / ${mod.parentName}` : ''
  lines.push(`## Module ${formatHybridId('mod', mod.name)} [${mod.name}]${role}`)

  for (const t of mod.types) {
    const fields = t.fields?.length
      ? `fields: ${t.fields.map((f) => `${f.name}: ${f.type}`).join(', ')}`
      : t.text
    const desc = fields ? ` — ${clip(fields, 240)}` : ''
    lines.push(`- ${formatHybridId('type', mod.name, t.name)} (type) ${t.name}${desc}`)
  }

  for (const v of mod.vars) {
    const desc = v.text ? ` — ${clip(v.text, 240)}` : ''
    lines.push(`- ${formatHybridId('var', mod.name, v.name)} (var) ${v.name}${desc}`)
  }

  for (const c of mod.consts) {
    const desc = c.text ? ` — ${clip(c.text, 240)}` : ''
    lines.push(`- ${formatHybridId('const', mod.name, c.name)} (const) ${c.name}${desc}`)
  }

  const invUsed = new Set<string>()
  for (const inv of mod.invariants) {
    const name = uniqueSlug(inv.text, invUsed)
    lines.push(`- ${formatHybridId('inv', mod.name, name)} (inv) ${clip(inv.text, 240)}`)
  }

  for (const proc of mod.processes) {
    lines.push(`- ${formatHybridId('proc', mod.name, proc.name)} (process) ${proc.name}`)
    if (proc.signature) lines.push(`  signature: ${clip(proc.signature, 200)}`)
    if (proc.pre) lines.push(`  pre: ${clip(proc.pre, 200)}`)
    if (proc.post) lines.push(`  post: ${clip(proc.post, 200)}`)
    if (proc.comment) lines.push(`  comment: ${clip(proc.comment, 200)}`)
    const scenarios = processScenarios(model.fsfModels, mod.name, proc.name)
    const used = new Set<string>()
    let normalIndex = 0
    let exceptionalIndex = 0
    for (const scenario of scenarios) {
      if (scenario.kind === 'exceptional') exceptionalIndex += 1
      else normalIndex += 1
      const indexInKind = scenario.kind === 'exceptional' ? exceptionalIndex : normalIndex
      const label = scenarioLabel(scenario, indexInKind)
      const idName = uniqueSlug(label, used)
      const guard = clip(scenario.guard || scenario.test || '', 80)
      const def = clip(scenario.definingCondition || scenario.def || '', 80)
      const detail = [guard, def].filter(Boolean).join(' / ')
      const desc = detail ? ` — ${detail}` : ''
      lines.push(`  - ${formatHybridId('scn', mod.name, proc.name, idName)} (scenario) ${label}${desc}`)
    }
  }

  for (const fn of mod.functions) {
    const sig = fn.signature ? ` — ${clip(fn.signature, 200)}` : ''
    lines.push(`- ${formatHybridId('fn', mod.name, fn.name)} (function) ${fn.name}${sig}`)
  }

  if (mod.gui) {
    const guiName = mod.gui.name || `${mod.name}_GUI`
    for (const screen of mod.gui.screens) {
      const widgets = screen.widgets.map((w) => w.name).filter(Boolean).join(', ')
      const desc = widgets ? ` widgets: ${clip(widgets, 200)}` : ''
      lines.push(`- ${formatHybridId('gui', guiName, screen.name)} (gui-screen) ${screen.name}${desc}`)
    }
  }

  return lines
}

export function formatHybridInventory(source: string, maxChars = 12000): string {
  if (!source.trim()) return '(empty hybrid specification)'
  const model = buildVisualModelTolerant(source)
  if (!model.modules.length) return '(empty hybrid specification)'
  const lines: string[] = []
  for (const mod of model.modules) {
    lines.push(...formatModuleInventory(model, mod))
    lines.push('')
  }
  const text = lines.join('\n').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…(truncated)`
}

export function hybridInventoryFromSource(source: string, maxChars = 12000): string {
  return formatHybridInventory(source, maxChars)
}
