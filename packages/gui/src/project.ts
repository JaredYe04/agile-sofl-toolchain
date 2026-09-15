import type { GuiBindRef, GuiBinds, GuiFlow, GuiScreen, GuiSection, GuiWidget, GuiWidgetKind } from './model.js'
import { findElements, innerText, type HtmlNode } from './html.js'

export function parseBindAttr(raw: string | undefined): GuiBindRef[] {
  if (!raw?.trim()) return []
  const refs: GuiBindRef[] = []
  for (const part of raw.split('|')) {
    const [kindRaw, name] = part.split(':').map((s) => s.trim())
    if (!kindRaw || !name) continue
    const kind =
      kindRaw === 'param' || kindRaw === 'var' || kindRaw === 'out' || kindRaw === 'display'
        ? kindRaw
        : kindRaw === 'variable'
          ? 'var'
          : null
    if (!kind) continue
    refs.push({ kind, name })
  }
  return refs
}

export function bindsFromRefs(refs: GuiBindRef[]): GuiBinds | undefined {
  if (!refs.length) return undefined
  const binds: GuiBinds = {}
  for (const ref of refs) {
    if (ref.kind === 'param') binds.param = ref.name
    else if (ref.kind === 'var') binds.variable = ref.name
    else if (ref.kind === 'out') binds.out = ref.name
    else binds.display = ref.name
  }
  return binds
}

function widgetKind(node: HtmlNode): GuiWidgetKind {
  const tag = node.tag ?? ''
  if (tag === 'button' && node.attrs['data-nav'] && !node.attrs['data-process']) return 'navigation'
  if (tag === 'button') return 'button'
  if (tag === 'input' && (node.attrs.type === 'checkbox' || node.attrs.type === 'radio')) return 'checkbox'
  if (tag === 'input' || tag === 'textarea') return 'text-input'
  if (tag === 'select') return 'select'
  if (tag === 'table') return 'table'
  if (tag === 'ul' || tag === 'ol') return 'list'
  if (tag === 'section' || node.attrs.class?.includes('as-card')) return 'section'
  return 'label'
}

function widgetId(node: HtmlNode, fallback: string): string {
  return node.attrs.id || node.attrs['data-id'] || fallback
}

export function extractScreens(root: HtmlNode): GuiScreen[] {
  const app = findElements(root, (n) => n.tag === 'div' && Boolean(n.attrs['data-app']))[0]
  const screenNodes = findElements(app ?? root, (n) => Boolean(n.attrs['data-screen']))
  return screenNodes.map((node, index) => {
    const name = node.attrs['data-screen'] || `Screen${index + 1}`
    const id = node.attrs.id || name
    const titleNode = findElements(node, (n) => n.tag === 'h1' || Boolean(n.attrs.class?.includes('as-title')))[0]
    const descNode = findElements(node, (n) => Boolean(n.attrs.class?.includes('as-muted')))[0]
    const interactive = findElements(
      node,
      (n) =>
        n !== node &&
        Boolean(
          n.tag === 'button' ||
            n.tag === 'input' ||
            n.tag === 'select' ||
            n.tag === 'textarea' ||
            n.tag === 'table' ||
            n.attrs['data-bind'] ||
            n.attrs['data-process'] ||
            n.attrs['data-nav']
        )
    )
    const widgets: GuiWidget[] = interactive.map((el, i) => {
      const refs = parseBindAttr(el.attrs['data-bind'])
      const nav = el.attrs['data-nav']
      const process = el.attrs['data-process']
      return {
        id: widgetId(el, `${id}-w${i}`),
        kind: widgetKind(el),
        label: innerText(el) || el.attrs.placeholder || el.attrs.name,
        binds: bindsFromRefs(refs),
        process,
        nav,
        action: process || nav,
        events: nav ? [{ on: 'click', action: 'navigate', targetView: nav }] : undefined
      }
    })
    const screenProcess = node.attrs['data-process'] || widgets.find((w) => w.process)?.process
    return {
      id,
      name,
      title: titleNode ? innerText(titleNode) : name,
      description: descNode ? innerText(descNode) : undefined,
      triggersProcess: screenProcess,
      widgets
    }
  })
}

export function extractFlows(screens: GuiScreen[]): GuiFlow[] {
  const flows: GuiFlow[] = []
  for (const screen of screens) {
    for (const widget of screen.widgets ?? []) {
      const to = widget.nav || widget.events?.find((e) => e.targetView)?.targetView
      if (!to) continue
      flows.push({ from: screen.id, to, on: widget.id, label: widget.label })
    }
  }
  return flows
}

export function extractAppName(root: HtmlNode): string {
  const app = findElements(root, (n) => Boolean(n.attrs['data-app']))[0]
  return app?.attrs['data-app'] || 'App'
}

export function sectionFromRoot(root: HtmlNode): GuiSection {
  const screens = extractScreens(root)
  return {
    app: { name: extractAppName(root) },
    screens,
    flows: extractFlows(screens)
  }
}
