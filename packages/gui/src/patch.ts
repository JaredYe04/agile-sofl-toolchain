import { parse as parseYaml, stringify } from 'yaml'
import type { GuiDocument, GuiFlow, GuiScreen, GuiSection, GuiWidget } from './model.js'
import { parseGuiSpec, parseGuiFromAspecYaml } from './parse.js'
import { serializeGuiSpec } from './serialize.js'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function setOnObject(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split('.')
  let cur: unknown = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const key = segs[i]!
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[key]
  }
  const last = segs[segs.length - 1]!
  if (cur && typeof cur === 'object') (cur as Record<string, unknown>)[last] = value
}

export function patchFieldById(source: string, idPath: string, value: unknown): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  const parts = idPath.split('.')
  if (parts.length < 2) return source

  const [kind, id, ...rest] = parts
  const field = rest.join('.')

  if (kind === 'app') {
    setOnObject(doc.gui.app as unknown as Record<string, unknown>, id, value)
    return serializeGuiSpec(doc)
  }

  if (kind === 'screen') {
    const screen = doc.gui.screens.find((s) => s.id === id)
    if (screen && field) {
      setOnObject(screen as unknown as Record<string, unknown>, field, value)
      return serializeGuiSpec(doc)
    }
  }

  if (kind === 'widget') {
    const widgetId = id
    const fieldName = field
    for (const screen of doc.gui.screens) {
      const widget = screen.widgets?.find((w) => w.id === widgetId)
      if (widget && fieldName) {
        setOnObject(widget as unknown as Record<string, unknown>, fieldName, value)
        return serializeGuiSpec(doc)
      }
    }
  }

  return source
}

export function addGuiScreen(source: string, screen: GuiScreen): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  if (!doc.gui.screens) doc.gui.screens = []
  doc.gui.screens.push(screen)
  return serializeGuiSpec(doc)
}

export function removeGuiScreen(source: string, screenId: string): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  doc.gui.screens = doc.gui.screens.filter((s) => s.id !== screenId)
  if (doc.gui.flows) {
    doc.gui.flows = doc.gui.flows.filter((f) => f.from !== screenId && f.to !== screenId)
  }
  return serializeGuiSpec(doc)
}

export function addGuiWidget(source: string, screenId: string, widget: GuiWidget): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  const screen = doc.gui.screens.find((s) => s.id === screenId)
  if (!screen) return source
  if (!screen.widgets) screen.widgets = []
  screen.widgets.push(widget)
  return serializeGuiSpec(doc)
}

export function removeGuiWidget(source: string, widgetId: string): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  for (const screen of doc.gui.screens) {
    if (screen.widgets) {
      screen.widgets = screen.widgets.filter((w) => w.id !== widgetId)
    }
  }
  return serializeGuiSpec(doc)
}

export function addGuiFlow(source: string, flow: GuiFlow): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  if (!doc.gui.flows) doc.gui.flows = []
  doc.gui.flows.push(flow)
  return serializeGuiSpec(doc)
}

export function removeGuiFlow(source: string, from: string, to: string): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  const doc = clone(document)
  if (!doc.gui.flows) return source
  doc.gui.flows = doc.gui.flows.filter((f) => !(f.from === from && f.to === to))
  return serializeGuiSpec(doc)
}

export type PatchGuiAction =
  | { action: 'patch-by-id'; idPath: string; value: unknown }
  | { action: 'add-screen'; screen: GuiScreen }
  | { action: 'remove-screen'; screenId: string }
  | { action: 'add-widget'; screenId: string; widget: GuiWidget }
  | { action: 'remove-widget'; widgetId: string }
  | { action: 'add-flow'; flow: GuiFlow }
  | { action: 'remove-flow'; from: string; to: string }
  | { action: 'patch-app'; field: string; value: unknown }

export function patchGui(source: string, payload: PatchGuiAction): string {
  switch (payload.action) {
    case 'patch-by-id':
      return patchFieldById(source, payload.idPath, payload.value)
    case 'add-screen':
      return addGuiScreen(source, payload.screen)
    case 'remove-screen':
      return removeGuiScreen(source, payload.screenId)
    case 'add-widget':
      return addGuiWidget(source, payload.screenId, payload.widget)
    case 'remove-widget':
      return removeGuiWidget(source, payload.widgetId)
    case 'add-flow':
      return addGuiFlow(source, payload.flow)
    case 'remove-flow':
      return removeGuiFlow(source, payload.from, payload.to)
    case 'patch-app': {
      const { document } = parseGuiSpec(source)
      if (!document) return source
      const doc = clone(document)
      setOnObject(doc.gui.app as unknown as Record<string, unknown>, payload.field, payload.value)
      return serializeGuiSpec(doc)
    }
    default:
      return source
  }
}

export function extractGuiFromAspec(aspecSource: string): GuiSection | null {
  return parseGuiFromAspecYaml(aspecSource).gui
}

export function embedGuiInAspec(aspecSource: string, gui: GuiSection): string {
  try {
    const raw = parseYaml(aspecSource)
    if (!isRecord(raw)) return aspecSource
    raw.gui = gui
    return stringify(raw, { lineWidth: 0 })
  } catch {
    return aspecSource
  }
}

export function removeGuiFromAspec(aspecSource: string): string {
  try {
    const raw = parseYaml(aspecSource)
    if (!isRecord(raw)) return aspecSource
    delete raw.gui
    return stringify(raw, { lineWidth: 0 })
  } catch {
    return aspecSource
  }
}

/** Merge embedded gui with external; external screens/flows take precedence on id collision. */
export function mergeGuiSources(embedded: GuiSection | null, external: GuiSection | null): GuiSection | null {
  if (!embedded && !external) return null
  if (!embedded) return external
  if (!external) return embedded

  const screenMap = new Map<string, GuiScreen>()
  for (const s of embedded.screens) screenMap.set(s.id, s)
  for (const s of external.screens) screenMap.set(s.id, s)

  const flowKey = (f: GuiFlow) => `${f.from}->${f.to}`
  const flowMap = new Map<string, GuiFlow>()
  for (const f of embedded.flows ?? []) flowMap.set(flowKey(f), f)
  for (const f of external.flows ?? []) flowMap.set(flowKey(f), f)

  return {
    app: external.app?.name ? external.app : embedded.app,
    screens: [...screenMap.values()],
    flows: [...flowMap.values()]
  }
}

export function guispecFromGuiSection(
  gui: GuiSection,
  meta: { id: string; title: string; informalTarget?: string }
): GuiDocument {
  return {
    guispecVersion: '1.0',
    meta,
    gui
  }
}

export function formatGui(source: string): string {
  const { document } = parseGuiSpec(source)
  if (!document) return source
  return serializeGuiSpec(document)
}
