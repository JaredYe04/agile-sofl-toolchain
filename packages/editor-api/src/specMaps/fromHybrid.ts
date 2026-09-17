import {
  PRIMARY_NODE_LIMIT,
  type HybridMapInput,
  InformalMapInput,
  SpecMap,
  SpecMapEdge,
  SpecMapLane,
  SpecMapNode
} from './types.js'
import {
  childNodes,
  isGuiModuleName,
  mapId,
  pushUniqueEdge,
  pushUniqueNode,
  sectionChildren,
  splitNames,
  walkInformal
} from './util.js'

function moduleKind(mod: HybridMapInput['modules'][number]): SpecMapNode['kind'] {
  if (isGuiModuleName(mod.name, Boolean(mod.gui))) return 'frontend'
  return 'backend'
}

export function architectureFromHybrid(hybrid: HybridMapInput | null | undefined): SpecMap | null {
  const modules = hybrid?.modules ?? []
  if (!modules.length) return null
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  const moduleIds = new Set<string>()

  for (const mod of modules) {
    const id = mapId('mod', mod.name)
    moduleIds.add(id)
    pushUniqueNode(nodes, {
      id,
      label: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
      kind: moduleKind(mod),
      specRef: { spec: 'hybrid', moduleName: mod.name }
    })
    if (mod.parentName) {
      pushUniqueEdge(edges, {
        id: mapId('parent', mod.name, mod.parentName),
        from: id,
        to: mapId('mod', mod.parentName),
        kind: 'parent',
        label: 'parent'
      })
    }
  }

  const extras: SpecMapNode[] = []
  const extraEdges: SpecMapEdge[] = []
  const resolveMemberId = (name: string): string | undefined => {
    for (const m of modules) {
      if (m.processes.some((p) => p.name === name)) return mapId('proc', m.name, name)
      if (m.functions.some((f) => f.name === name)) return mapId('fn', m.name, name)
    }
    return undefined
  }
  for (const mod of modules) {
    for (const proc of mod.processes) {
      const id = mapId('proc', mod.name, proc.name)
      extras.push({
        id,
        label: proc.name,
        kind: proc.isInit ? 'start' : 'process',
        specRef: { spec: 'hybrid', moduleName: mod.name, processName: proc.name }
      })
      extraEdges.push({
        id: mapId('owns', mod.name, proc.name),
        from: mapId('mod', mod.name),
        to: id,
        kind: 'parent'
      })
      const decom = proc.decom?.trim()
      const decomId = decom ? resolveMemberId(decom) : undefined
      if (decom && decomId) {
        extraEdges.push({
          id: mapId('decom', mod.name, proc.name, decom),
          from: id,
          to: decomId,
          kind: 'decom',
          label: 'decom'
        })
      }
    }
    for (const fn of mod.functions) {
      const id = mapId('fn', mod.name, fn.name)
      extras.push({
        id,
        label: fn.name,
        kind: 'process',
        specRef: { spec: 'hybrid', moduleName: mod.name, functionName: fn.name }
      })
      extraEdges.push({
        id: mapId('ownsfn', mod.name, fn.name),
        from: mapId('mod', mod.name),
        to: id,
        kind: 'parent'
      })
    }
    for (const screen of mod.gui?.screens ?? []) {
      const proc = screen.triggersProcess?.trim()
      if (!proc) continue
      const to = resolveMemberId(proc.split('.').pop() ?? proc)
      if (!to) continue
      extraEdges.push({
        id: mapId('gui', mod.name, screen.name, proc),
        from: mapId('mod', mod.name),
        to,
        kind: 'call',
        label: screen.name
      })
    }
  }

  const includeExtras = nodes.length + extras.length <= PRIMARY_NODE_LIMIT
  if (includeExtras) {
    const extraIds = new Set(extras.map((n) => n.id))
    nodes.push(...extras)
    for (const edge of extraEdges) {
      const fromOk = moduleIds.has(edge.from) || extraIds.has(edge.from)
      const toOk = moduleIds.has(edge.to) || extraIds.has(edge.to)
      if (fromOk && toOk) pushUniqueEdge(edges, edge)
    }
  }

  return {
    type: 'architecture',
    title: 'architecture',
    nodes,
    edges,
    truncatedCount: includeExtras ? undefined : extras.length
  }
}

export function architectureFromInformal(informal: InformalMapInput | null | undefined): SpecMap | null {
  if (!informal) return null
  const functions = sectionChildren(informal, 'functions')
  const data = sectionChildren(informal, 'data-resources')
  if (!functions.length && !data.length) return null
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  walkInformal(functions, (node, _depth, parent) => {
    if (node.type !== 'function') return
    pushUniqueNode(nodes, {
      id: mapId('inf', node.id),
      label: node.title,
      kind: 'backend',
      specRef: { spec: 'informal', id: node.id }
    })
    if (parent) {
      pushUniqueEdge(edges, {
        id: mapId('infparent', parent.id, node.id),
        from: mapId('inf', parent.id),
        to: mapId('inf', node.id),
        kind: 'parent'
      })
    }
  })
  walkInformal(data, (node) => {
    if (node.type !== 'data-resource') return
    pushUniqueNode(nodes, {
      id: mapId('inf', node.id),
      label: node.title,
      kind: 'database',
      specRef: { spec: 'informal', id: node.id }
    })
  })
  if (!nodes.length) return null
  return { type: 'architecture', title: 'architecture', nodes, edges }
}

export function workflowFromHybrid(hybrid: HybridMapInput | null | undefined): SpecMap | null {
  const modules = hybrid?.modules ?? []
  if (!modules.length) return null
  const fsfModels = hybrid?.fsfModels ?? []
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  const lanes: SpecMapLane[] = []

  const ranked = [...fsfModels].sort((a, b) => {
    const ac = (a.scenarios?.length ?? 0) + (a.exceptionalScenarios?.length ?? 0)
    const bc = (b.scenarios?.length ?? 0) + (b.exceptionalScenarios?.length ?? 0)
    return bc - ac
  })
  const focus = ranked.find((m) => (m.scenarios?.length ?? 0) + (m.exceptionalScenarios?.length ?? 0) > 0)

  if (focus) {
    const moduleName =
      focus.moduleName ??
      modules.find((m) => m.processes.some((p) => p.name === focus.processName))?.name ??
      modules[0]!.name
    const laneId = mapId('lane', moduleName)
    lanes.push({ id: laneId, label: moduleName })
    const procId = mapId('proc', moduleName, focus.processName)
    pushUniqueNode(nodes, {
      id: procId,
      label: focus.processName,
      kind: 'active',
      laneId,
      specRef: { spec: 'hybrid', moduleName, processName: focus.processName }
    })
    const scenarios = [...(focus.scenarios ?? []), ...(focus.exceptionalScenarios ?? [])]
    for (const scn of scenarios) {
      const id = mapId('scn', moduleName, focus.processName, scn.id || scn.name || 's')
      const exceptional = scn.kind === 'exceptional'
      pushUniqueNode(nodes, {
        id,
        label: scn.name || scn.id || (exceptional ? 'exception' : 'scenario'),
        kind: exceptional ? 'failure' : 'success',
        laneId,
        specRef: { spec: 'hybrid', moduleName, processName: focus.processName }
      })
      pushUniqueEdge(edges, {
        id: mapId('fsf', procId, id),
        from: procId,
        to: id,
        kind: exceptional ? 'exception' : 'flow',
        label: exceptional ? 'exception' : undefined
      })
    }
  }

  for (const mod of modules) {
    for (const proc of mod.processes) {
      const decom = proc.decom?.trim()
      if (!decom) continue
      const fromId = mapId('proc', mod.name, proc.name)
      const toId = mapId('proc', mod.name, decom)
      const targetExists = modules.some((m) => m.processes.some((p) => p.name === decom) || m.functions.some((f) => f.name === decom))
      if (!targetExists) continue
      if (!nodes.some((n) => n.id === fromId)) {
        pushUniqueNode(nodes, {
          id: fromId,
          label: proc.name,
          kind: proc.isInit ? 'start' : 'process',
          laneId: mapId('lane', mod.name),
          specRef: { spec: 'hybrid', moduleName: mod.name, processName: proc.name }
        })
      }
      if (!nodes.some((n) => n.id === toId)) {
        pushUniqueNode(nodes, {
          id: toId,
          label: decom,
          kind: 'process',
          laneId: mapId('lane', mod.name),
          specRef: { spec: 'hybrid', moduleName: mod.name, processName: decom }
        })
      }
      if (!lanes.some((l) => l.id === mapId('lane', mod.name))) {
        lanes.push({ id: mapId('lane', mod.name), label: mod.name })
      }
      pushUniqueEdge(edges, {
        id: mapId('decom', fromId, toId),
        from: fromId,
        to: toId,
        kind: 'decom',
        label: 'decom'
      })
    }
  }

  if (!nodes.length) return null
  return { type: 'workflow', title: 'workflow', nodes, edges, lanes: lanes.length ? lanes : undefined }
}

export function dataflowFromHybrid(hybrid: HybridMapInput | null | undefined): SpecMap | null {
  const modules = hybrid?.modules ?? []
  if (!modules.length) return null
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  const varIds = new Map<string, string>()

  for (const mod of modules) {
    for (const v of mod.vars ?? []) {
      const id = mapId('var', mod.name, v.name)
      varIds.set(v.name, id)
      varIds.set(`${mod.name}.${v.name}`, id)
      pushUniqueNode(nodes, {
        id,
        label: v.name,
        kind: 'store',
        specRef: { spec: 'hybrid', moduleName: mod.name, varName: v.name }
      })
    }
    for (const t of mod.types ?? []) {
      const id = mapId('type', mod.name, t.name)
      pushUniqueNode(nodes, {
        id,
        label: t.name,
        kind: 'database',
        specRef: { spec: 'hybrid', moduleName: mod.name, typeName: t.name }
      })
    }
  }

  let hasAccess = false
  for (const mod of modules) {
    for (const proc of mod.processes) {
      const procId = mapId('proc', mod.name, proc.name)
      const hasExt = (proc.ext?.length ?? 0) > 0
      const inNames = (proc.inputs ?? []).flatMap((g) => splitNames(g.names))
      const outNames = (proc.outputs ?? []).flatMap((g) => splitNames(g.names))
      if (!hasExt && !inNames.some((n) => varIds.has(n)) && !outNames.some((n) => varIds.has(n))) {
        continue
      }
      pushUniqueNode(nodes, {
        id: procId,
        label: proc.name,
        kind: 'process',
        specRef: { spec: 'hybrid', moduleName: mod.name, processName: proc.name }
      })
      for (const ext of proc.ext ?? []) {
        let storeId = varIds.get(ext.name) ?? varIds.get(`${mod.name}.${ext.name}`)
        if (!storeId) {
          storeId = mapId('ext', mod.name, ext.name)
          varIds.set(ext.name, storeId)
          pushUniqueNode(nodes, {
            id: storeId,
            label: ext.name,
            kind: 'store',
            specRef: { spec: 'hybrid', moduleName: mod.name, varName: ext.name }
          })
        }
        hasAccess = true
        if (ext.access === 'rd') {
          pushUniqueEdge(edges, {
            id: mapId('rd', storeId, procId),
            from: storeId,
            to: procId,
            kind: 'read',
            label: 'rd'
          })
        } else {
          pushUniqueEdge(edges, {
            id: mapId('wr', procId, storeId),
            from: procId,
            to: storeId,
            kind: 'write',
            label: 'wr'
          })
        }
      }
      for (const name of inNames) {
        const storeId = varIds.get(name)
        if (!storeId) continue
        hasAccess = true
        pushUniqueEdge(edges, {
          id: mapId('in', storeId, procId, name),
          from: storeId,
          to: procId,
          kind: 'flow',
          label: name
        })
      }
      for (const name of outNames) {
        const storeId = varIds.get(name)
        if (!storeId) continue
        hasAccess = true
        pushUniqueEdge(edges, {
          id: mapId('out', procId, storeId, name),
          from: procId,
          to: storeId,
          kind: 'flow',
          label: name
        })
      }
    }
  }

  if (!nodes.length) return null
  if (!hasAccess && !(modules.some((m) => (m.vars?.length ?? 0) > 0 || (m.types?.length ?? 0) > 0))) {
    return null
  }
  return { type: 'dataflow', title: 'dataflow', nodes, edges }
}

export function lifecycleFromHybrid(hybrid: HybridMapInput | null | undefined): SpecMap | null {
  const modules = hybrid?.modules ?? []
  const fsfModels = hybrid?.fsfModels ?? []
  const init = modules.flatMap((m) => m.processes.filter((p) => p.isInit).map((p) => ({ mod: m.name, proc: p })))[0]
  const focus =
    fsfModels.find((m) => m.processName === init?.proc.name) ??
    fsfModels.find((m) => (m.scenarios?.length ?? 0) + (m.exceptionalScenarios?.length ?? 0) > 0)
  if (!init && !focus) return null

  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  const moduleName = focus?.moduleName ?? init?.mod ?? modules[0]?.name ?? 'System'
  const processName = focus?.processName ?? init?.proc.name ?? 'Init'
  const startId = mapId('life', moduleName, processName)
  pushUniqueNode(nodes, {
    id: startId,
    label: processName,
    kind: 'start',
    specRef: { spec: 'hybrid', moduleName, processName }
  })
  const scenarios = [...(focus?.scenarios ?? []), ...(focus?.exceptionalScenarios ?? [])]
  for (const scn of scenarios) {
    const id = mapId('lifescn', moduleName, processName, scn.id || scn.name || 's')
    const exceptional = scn.kind === 'exceptional'
    pushUniqueNode(nodes, {
      id,
      label: scn.name || scn.id || (exceptional ? 'failure' : 'success'),
      kind: exceptional ? 'failure' : 'success',
      specRef: { spec: 'hybrid', moduleName, processName }
    })
    pushUniqueEdge(edges, {
      id: mapId('lifeflow', startId, id),
      from: startId,
      to: id,
      kind: 'transition',
      label: exceptional ? 'exception' : undefined
    })
  }
  return { type: 'lifecycle', title: 'lifecycle', nodes, edges }
}

export function workflowFromInformal(informal: InformalMapInput | null | undefined): SpecMap | null {
  if (!informal) return null
  const roots = sectionChildren(informal, 'functions')
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  let nested = false
  walkInformal(roots, (node, depth, parent) => {
    if (node.type !== 'function') return
    pushUniqueNode(nodes, {
      id: mapId('inf', node.id),
      label: node.title,
      kind: depth === 0 ? 'start' : 'active',
      specRef: { spec: 'informal', id: node.id }
    })
    if (parent) {
      nested = true
      pushUniqueEdge(edges, {
        id: mapId('step', parent.id, node.id),
        from: mapId('inf', parent.id),
        to: mapId('inf', node.id),
        kind: 'flow'
      })
    }
  })
  if (!nested) return null
  return { type: 'workflow', title: 'workflow', nodes, edges }
}

export function dataflowFromInformal(informal: InformalMapInput | null | undefined): SpecMap | null {
  if (!informal) return null
  const data = sectionChildren(informal, 'data-resources')
  if (!data.length) return null
  const nodes: SpecMapNode[] = []
  const edges: SpecMapEdge[] = []
  walkInformal(data, (node, _depth, parent) => {
    if (node.type !== 'data-resource' && node.type !== 'data-field') return
    pushUniqueNode(nodes, {
      id: mapId('inf', node.id),
      label: node.title,
      kind: node.type === 'data-field' ? 'store' : 'database',
      specRef: { spec: 'informal', id: node.id }
    })
    if (parent) {
      pushUniqueEdge(edges, {
        id: mapId('field', parent.id, node.id),
        from: mapId('inf', parent.id),
        to: mapId('inf', node.id),
        kind: 'flow',
        label: 'field'
      })
    }
  })
  if (!nodes.length) return null
  return { type: 'dataflow', title: 'dataflow', nodes, edges }
}

export function sequenceFromInformal(informal: InformalMapInput | null | undefined): SpecMap | null {
  if (!informal) return null
  const roots = sectionChildren(informal, 'functions')
  const userId = mapId('actor', 'User')
  const nodes: SpecMapNode[] = [
    { id: userId, label: 'User', kind: 'external', column: 0 }
  ]
  const edges: SpecMapEdge[] = []
  let col = 1
  let nested = false
  walkInformal(roots, (node, depth, parent) => {
    if (node.type !== 'function') return
    if (depth === 0 && !childNodes(node).length) return
    nested = nested || depth > 0
    const id = mapId('inf', node.id)
    pushUniqueNode(nodes, {
      id,
      label: node.title,
      kind: 'backend',
      column: col,
      specRef: { spec: 'informal', id: node.id }
    })
    col += 1
    const from = parent ? mapId('inf', parent.id) : userId
    pushUniqueEdge(edges, {
      id: mapId('msg', from, id),
      from,
      to: id,
      kind: 'message',
      label: node.title
    })
  })
  if (!nested) return null
  return { type: 'sequence', title: 'sequence', nodes, edges }
}
