import type { GuiMapInput, SpecMap } from './types.js'
import { mapId, pushUniqueEdge, pushUniqueNode } from './util.js'

function screenLabel(screen: GuiMapInput['screens'][number]): string {
  return screen.title?.trim() || screen.name
}

function resolveScreenId(gui: GuiMapInput, raw: string): string | null {
  const key = raw.trim()
  if (!key) return null
  const found = gui.screens.find((s) => s.id === key || s.name === key || s.title === key)
  return found ? mapId('scr', found.id) : null
}

function processParticipantId(name: string): string {
  return mapId('gproc', name.replace(/\./g, '_'))
}

export function sequenceFromGui(gui: GuiMapInput | null | undefined): SpecMap | null {
  if (!gui?.screens.length) return null
  const nodes: SpecMap['nodes'] = []
  const edges: SpecMap['edges'] = []
  let column = 0
  for (const screen of gui.screens) {
    pushUniqueNode(nodes, {
      id: mapId('scr', screen.id),
      label: screenLabel(screen),
      kind: 'frontend',
      column,
      specRef: { spec: 'gui', screenId: screen.id }
    })
    column += 1
  }

  const addProcess = (name: string) => {
    const id = processParticipantId(name)
    if (!nodes.some((n) => n.id === id)) {
      pushUniqueNode(nodes, {
        id,
        label: name,
        kind: 'backend',
        column
      })
      column += 1
    }
    return id
  }

  for (const flow of gui.flows ?? []) {
    const from = resolveScreenId(gui, flow.from)
    const to = resolveScreenId(gui, flow.to)
    if (!from || !to) continue
    pushUniqueEdge(edges, {
      id: mapId('flow', from, to, flow.on ?? flow.label ?? ''),
      from,
      to,
      kind: 'nav',
      label: flow.label || flow.on
    })
  }

  for (const screen of gui.screens) {
    const from = mapId('scr', screen.id)
    if (screen.triggersProcess?.trim()) {
      const to = addProcess(screen.triggersProcess.trim())
      pushUniqueEdge(edges, {
        id: mapId('trig', from, to),
        from,
        to,
        kind: 'call',
        label: screen.triggersProcess.trim()
      })
    }
    for (const widget of screen.widgets ?? []) {
      const nav = widget.nav?.trim() || widget.events?.find((e) => e.targetView)?.targetView?.trim()
      if (nav) {
        const to = resolveScreenId(gui, nav)
        if (to) {
          pushUniqueEdge(edges, {
            id: mapId('wnav', from, to, widget.id ?? nav),
            from,
            to,
            kind: 'nav',
            label: nav
          })
        }
      }
      const proc = widget.process?.trim()
      if (proc) {
        const to = addProcess(proc)
        pushUniqueEdge(edges, {
          id: mapId('wproc', from, to, widget.id ?? proc),
          from,
          to,
          kind: 'call',
          label: proc
        })
      }
    }
  }

  if (!edges.length) return null
  return { type: 'sequence', title: 'sequence', nodes, edges }
}

export function lifecycleFromGui(gui: GuiMapInput | null | undefined): SpecMap | null {
  if (!gui?.screens.length) return null
  const nodes: SpecMap['nodes'] = []
  const edges: SpecMap['edges'] = []
  const incoming = new Set<string>()
  const outgoing = new Set<string>()
  for (const flow of gui.flows ?? []) {
    const from = resolveScreenId(gui, flow.from)
    const to = resolveScreenId(gui, flow.to)
    if (!from || !to) continue
    outgoing.add(from)
    incoming.add(to)
    pushUniqueEdge(edges, {
      id: mapId('life', from, to, flow.on ?? ''),
      from,
      to,
      kind: 'transition',
      label: flow.label || flow.on
    })
  }
  for (const screen of gui.screens) {
    const from = mapId('scr', screen.id)
    for (const widget of screen.widgets ?? []) {
      const nav = widget.nav?.trim() || widget.events?.find((e) => e.targetView)?.targetView?.trim()
      if (!nav) continue
      const to = resolveScreenId(gui, nav)
      if (!to) continue
      outgoing.add(from)
      incoming.add(to)
      pushUniqueEdge(edges, {
        id: mapId('wnavlife', from, to, widget.id ?? nav),
        from,
        to,
        kind: 'transition',
        label: nav
      })
    }
  }
  for (const [index, screen] of gui.screens.entries()) {
    const id = mapId('scr', screen.id)
    const isStart = index === 0 || !incoming.has(id)
    const isTerminal = !outgoing.has(id) && incoming.has(id)
    pushUniqueNode(nodes, {
      id,
      label: screenLabel(screen),
      kind: isStart ? 'start' : isTerminal ? 'success' : 'active',
      specRef: { spec: 'gui', screenId: screen.id }
    })
  }
  return { type: 'lifecycle', title: 'lifecycle', nodes, edges }
}

export function architectureGuiBindings(gui: GuiMapInput | null | undefined, map: SpecMap): void {
  if (!gui || map.type !== 'architecture') return
  for (const screen of gui.screens) {
    const proc = screen.triggersProcess?.trim()
    if (!proc) continue
    const short = proc.split('.').pop() ?? proc
    const to = map.nodes.find((n) => n.label === short || n.label === proc)
    if (!to) continue
    const from = map.nodes.find((n) => n.kind === 'frontend')
    if (!from) continue
    pushUniqueEdge(map.edges, {
      id: mapId('guibind', from.id, to.id, screen.id),
      from: from.id,
      to: to.id,
      kind: 'call',
      label: screenLabel(screen)
    })
  }
}
