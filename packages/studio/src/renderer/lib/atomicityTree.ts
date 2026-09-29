import type {
  DataRefinementItemView,
  RefinementLogEntry,
  RefinementModuleRow,
  RefinementProcessRow,
  RefinementStateDto
} from './refinementTypes'

export type AtomicityRowKind =
  | 'process-root'
  | 'data-root'
  | 'log-root'
  | 'module'
  | 'composite'
  | 'leaf'
  | 'gate'
  | 'atom'
  | 'data'
  | 'log'
  | 'gap'

export type GateId = 'decom' | 'informal' | 'types' | 'coverage' | 'cdfd' | 'grain'

export interface AtomicityRow {
  id: string
  depth: number
  kind: AtomicityRowKind
  label: string
  expandable?: boolean
  status?: 'atomic' | 'ready' | 'open' | 'pass' | 'fail' | 'done'
  moduleName?: string
  processName?: string
  summary?: string
  audit?: string
  leafAtomic?: number
  leafTotal?: number
  gateId?: GateId
  dataKind?: DataRefinementItemView['kind']
  problem?: boolean
  isEmpty?: boolean
  isStub?: boolean
}

function moduleLabel(mod: RefinementModuleRow): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

function findModule(
  modules: RefinementModuleRow[],
  name: string | undefined
): RefinementModuleRow | undefined {
  if (!name) return undefined
  const bare = name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
  return modules.find((m) => m.name === name || m.name === bare || `SYSTEM_${m.name}` === name)
}

function decomTargets(processes: RefinementProcessRow[]): Set<string> {
  const set = new Set<string>()
  for (const p of processes) {
    const t = p.decomTarget?.trim()
    if (!t) continue
    set.add(t)
    if (t.startsWith('SYSTEM_')) set.add(t.slice('SYSTEM_'.length))
    else set.add(`SYSTEM_${t}`)
  }
  return set
}

function processesOf(rows: RefinementProcessRow[], moduleName: string): RefinementProcessRow[] {
  return rows.filter((p) => p.moduleName === moduleName)
}

export function leafStats(
  state: RefinementStateDto,
  moduleName: string,
  seen = new Set<string>()
): { atomic: number; total: number } {
  if (seen.has(moduleName)) return { atomic: 0, total: 0 }
  seen.add(moduleName)
  let atomic = 0
  let total = 0
  for (const proc of processesOf(state.processes, moduleName)) {
    if (proc.hasDecom && proc.decomTarget) {
      const child = findModule(state.modules, proc.decomTarget)
      if (child) {
        const nested = leafStats(state, child.name, seen)
        atomic += nested.atomic
        total += nested.total
      } else {
        total += 1
      }
      continue
    }
    total += 1
    if (proc.status === 'atomic') atomic += 1
  }
  if (total === 0) {
    const mod = findModule(state.modules, moduleName)
    if (mod?.isEmpty) return { atomic: 0, total: 1 }
  }
  return { atomic, total }
}

function logForBits(log: RefinementLogEntry[], bits: string[]): RefinementLogEntry[] {
  return log.filter((e) => {
    const parts = e.target.split('::')
    return bits.every((b) => parts.includes(b))
  })
}

function auditText(entries: RefinementLogEntry[], data = false): string | undefined {
  const last = entries[entries.length - 1]
  if (!last) return undefined
  const before = data ? last.dataAmbiguityBefore : last.processAmbiguityBefore
  const after = data ? last.dataAmbiguityAfter : last.processAmbiguityAfter
  return `${last.kind} ${before} → ${after}`
}

function gateOrder(proc: RefinementProcessRow): Array<{ id: GateId; ok: boolean }> {
  const gates: Array<{ id: GateId; ok: boolean }> = [
    { id: 'decom', ok: !proc.hasDecom },
    { id: 'informal', ok: proc.informalAtomCount === 0 },
    { id: 'types', ok: proc.typesDefined },
    { id: 'coverage', ok: proc.scenarioCoverageComplete },
    { id: 'cdfd', ok: proc.onCdfd },
    { id: 'grain', ok: proc.grainClosed === true }
  ]
  return gates.sort((a, b) => Number(a.ok) - Number(b.ok))
}

function defaultExpanded(state: RefinementStateDto): Set<string> {
  const open = new Set<string>(['process-root', 'data-root'])
  for (const mod of state.modules) {
    if (mod.isEmpty) open.add(`mod:${mod.name}`)
  }
  return open
}

export function initialExpandedIds(state: RefinementStateDto): string[] {
  return [...defaultExpanded(state)]
}

export function buildAtomicityRows(state: RefinementStateDto, expanded: Set<string>): AtomicityRow[] {
  const rows: AtomicityRow[] = []
  const targets = decomTargets(state.processes)
  const roots = state.modules.filter((m) => !targets.has(m.name) && !targets.has(`SYSTEM_${m.name}`))

  rows.push({
    id: 'process-root',
    depth: 0,
    kind: 'process-root',
    label: 'process',
    expandable: true,
    summary: String(state.processAmbiguity),
    problem: state.processAmbiguity > 0
  })
  if (expanded.has('process-root')) {
    for (const mod of roots) pushModule(state, rows, expanded, mod, 1)
  }

  rows.push({
    id: 'data-root',
    depth: 0,
    kind: 'data-root',
    label: 'data',
    expandable: true,
    summary: String(state.dataAmbiguity),
    problem: state.dataAmbiguity > 0
  })
  if (expanded.has('data-root')) {
    for (const item of state.dataItems) {
      rows.push(dataRow(item, state.log, 1))
    }
  }

  rows.push({
    id: 'log-root',
    depth: 0,
    kind: 'log-root',
    label: 'log',
    expandable: true,
    summary: String(state.log.length)
  })
  if (expanded.has('log-root')) {
    for (const entry of [...state.log].reverse()) {
      rows.push({
        id: `log:${entry.id}`,
        depth: 1,
        kind: 'log',
        label: entry.kind,
        summary: entry.target,
        audit: `${entry.processAmbiguityBefore} → ${entry.processAmbiguityAfter} / ${entry.dataAmbiguityBefore} → ${entry.dataAmbiguityAfter}`
      })
    }
  }

  return rows
}

function dataRow(item: DataRefinementItemView, log: RefinementLogEntry[], depth: number): AtomicityRow {
  const bits = [item.typeName, item.retrieveFunction].filter((x): x is string => Boolean(x))
  const entries = logForBits(log, bits.length ? bits.slice(0, 1) : [item.typeName])
  return {
    id: `data:${item.target}`,
    depth,
    kind: 'data',
    label: item.retrieveFunction ? `${item.typeName} · ${item.retrieveFunction}` : item.typeName,
    summary: item.message,
    dataKind: item.kind,
    status: item.discharged ? 'done' : 'open',
    problem: !item.discharged,
    audit: auditText(entries, true)
  }
}

function pushModule(
  state: RefinementStateDto,
  rows: AtomicityRow[],
  expanded: Set<string>,
  mod: RefinementModuleRow,
  depth: number
): void {
  const id = `mod:${mod.name}`
  const stats = leafStats(state, mod.name)
  rows.push({
    id,
    depth,
    kind: 'module',
    label: moduleLabel(mod),
    expandable: true,
    moduleName: mod.name,
    leafAtomic: stats.atomic,
    leafTotal: stats.total,
    summary: `${stats.atomic}/${stats.total}`,
    status: mod.isEmpty ? 'open' : undefined,
    problem: Boolean(mod.isEmpty),
    isEmpty: mod.isEmpty
  })
  if (!expanded.has(id)) return
  if (mod.isEmpty) {
    rows.push({
      id: `${id}:gap`,
      depth: depth + 1,
      kind: 'gap',
      label: 'empty-module',
      moduleName: mod.name,
      status: 'fail',
      problem: true,
      isEmpty: true
    })
    return
  }
  for (const proc of processesOf(state.processes, mod.name)) {
    if (proc.hasDecom) pushComposite(state, rows, expanded, proc, depth + 1)
    else pushLeaf(state, rows, expanded, proc, depth + 1)
  }
}

function pushComposite(
  state: RefinementStateDto,
  rows: AtomicityRow[],
  expanded: Set<string>,
  proc: RefinementProcessRow,
  depth: number
): void {
  const id = `proc:${proc.moduleName}:${proc.processName}`
  const child = findModule(state.modules, proc.decomTarget)
  const stats = child ? leafStats(state, child.name) : { atomic: 0, total: 0 }
  const entries = logForBits(state.log, [proc.moduleName, proc.processName])
  rows.push({
    id,
    depth,
    kind: 'composite',
    label: proc.processName,
    expandable: true,
    moduleName: proc.moduleName,
    processName: proc.processName,
    status: 'open',
    leafAtomic: stats.atomic,
    leafTotal: stats.total,
    summary: `${stats.atomic}/${stats.total}`,
    audit: auditText(entries),
    problem: stats.atomic < stats.total || !child
  })
  if (!expanded.has(id)) return
  if (child) pushModule(state, rows, expanded, child, depth + 1)
  else if (proc.decomTarget) {
    rows.push({
      id: `missing:${id}`,
      depth: depth + 1,
      kind: 'gap',
      label: 'missing-module',
      moduleName: proc.decomTarget,
      summary: proc.decomTarget,
      status: 'fail',
      problem: true,
      isEmpty: true
    })
  }
}

function pushLeaf(
  state: RefinementStateDto,
  rows: AtomicityRow[],
  expanded: Set<string>,
  proc: RefinementProcessRow,
  depth: number
): void {
  const id = `proc:${proc.moduleName}:${proc.processName}`
  const entries = logForBits(state.log, [proc.moduleName, proc.processName])
  rows.push({
    id,
    depth,
    kind: 'leaf',
    label: proc.processName,
    expandable: true,
    moduleName: proc.moduleName,
    processName: proc.processName,
    status: proc.status,
    summary: proc.status,
    audit: auditText(entries),
    problem: proc.status !== 'atomic',
    isStub: proc.isStub
  })
  if (!expanded.has(id)) return
  for (const gate of gateOrder(proc)) {
    const gateId = `${id}:gate:${gate.id}`
    rows.push({
      id: gateId,
      depth: depth + 1,
      kind: 'gate',
      label: gate.id,
      gateId: gate.id,
      status: gate.ok ? 'pass' : 'fail',
      expandable:
        (gate.id === 'informal' && !gate.ok && proc.informalAtoms.length > 0) ||
        (gate.id === 'grain' && !gate.ok && (proc.variations ?? []).some((variation) => variation.disposition === 'unresolved')),
      problem: !gate.ok,
      moduleName: proc.moduleName,
      processName: proc.processName
    })
    if (gate.id === 'informal' && !gate.ok && expanded.has(gateId)) {
      for (const atom of proc.informalAtoms) {
        rows.push({
          id: `atom:${atom.key}`,
          depth: depth + 2,
          kind: 'atom',
          label: atom.text,
          summary: atom.clause,
          problem: true,
          moduleName: proc.moduleName,
          processName: proc.processName
        })
      }
    }
    if (gate.id === 'grain' && !gate.ok && expanded.has(gateId)) {
      for (const variation of (proc.variations ?? []).filter((item) => item.disposition === 'unresolved')) {
        rows.push({
          id: `grain:${proc.moduleName}:${proc.processName}:${variation.id}`,
          depth: depth + 2,
          kind: 'atom',
          label: variation.text,
          summary: variation.disposition,
          problem: true,
          moduleName: proc.moduleName,
          processName: proc.processName,
          gateId: 'grain'
        })
      }
    }
  }
}

export interface DualLineProgress {
  overall: number
  processRate: number
  dataRate: number
  grainRate: number
  atomicLeaves: number
  expectedLeaves: number
  emptyModules: number
  stubProcesses: number
  remaining: {
    empty: number
    stub: number
    informal: number
    coverage: number
    cond: number
    boundary: number
    undeclared: number
    data: number
    grain: number
  }
}

/** Process, data, and operational-grain rates, combined by a three-way harmonic mean. */
export function dualLineProgress(state: RefinementStateDto): DualLineProgress {
  const targets = decomTargets(state.processes)
  const roots = state.modules.filter((m) => !targets.has(m.name) && !targets.has(`SYSTEM_${m.name}`))
  let atomicLeaves = 0
  let expectedLeaves = 0
  for (const mod of roots) {
    const s = leafStats(state, mod.name)
    atomicLeaves += s.atomic
    expectedLeaves += s.total
  }
  const processRate = expectedLeaves <= 0 ? 0 : atomicLeaves / expectedLeaves
  const dataOpen = state.dataItems.filter((d) => !d.discharged).length
  const dataTotal = state.dataItems.length
  const dataRate =
    dataTotal === 0 ? (state.breakdown.emptyModuleCount > 0 ? 0 : 1) : (dataTotal - dataOpen) / dataTotal
  const grainAmbiguity = state.grainAmbiguity ?? 0
  const grainLeaves = state.processes.filter((p) => !p.hasDecom)
  const grainClosedLeaves = grainLeaves.filter((p) => p.grainClosed).length
  const grainRate =
    grainAmbiguity === 0 ? 1 : grainLeaves.length === 0 ? 0 : grainClosedLeaves / (grainClosedLeaves + grainAmbiguity)
  const overall = harmonicMean([processRate, dataRate, grainRate])
  return {
    overall,
    processRate,
    dataRate,
    grainRate,
    atomicLeaves,
    expectedLeaves,
    emptyModules: state.breakdown.emptyModuleCount ?? 0,
    stubProcesses: state.breakdown.stubProcessCount ?? 0,
    remaining: {
      empty: state.breakdown.emptyModuleCount ?? 0,
      stub: state.breakdown.stubProcessCount ?? 0,
      informal: state.breakdown.informalAtomCount,
      coverage: state.breakdown.incompleteScenarioCount,
      cond: state.breakdown.openConditionCount,
      boundary: state.breakdown.unbalancedBoundaryCount,
      undeclared: state.breakdown.undeclaredAtomicCount,
      data: dataOpen,
      grain: grainAmbiguity
    }
  }
}

function harmonicMean(parts: number[]): number {
  if (parts.some((part) => part <= 0)) return 0
  return parts.length / parts.reduce((sum, part) => sum + 1 / part, 0)
}
