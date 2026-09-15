import { parse as parseYaml } from 'yaml'
import type { GuiDocument, GuiScreen, GuiSection, GuiWidget } from './model.js'
import { emptyGuiHtml, escapeAttr, escapeText } from './dialect.js'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function widgetHtml(widget: GuiWidget): string {
  const id = widget.id ? ` id="${escapeAttr(widget.id)}"` : ''
  const bind = widget.binds
    ? Object.entries(widget.binds)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k === 'variable' ? 'var' : k}:${v}`)
        .join('|')
    : ''
  const bindAttr = bind ? ` data-bind="${escapeAttr(bind)}"` : ''
  const process = widget.action && widget.kind === 'button' ? ` data-process="${escapeAttr(widget.action)}"` : ''
  const navEvent = widget.events?.find((e) => e.action === 'navigate' && e.targetView)
  const nav =
    widget.kind === 'navigation' || navEvent
      ? ` data-nav="${escapeAttr(navEvent?.targetView ?? widget.action ?? '')}"`
      : ''
  const label = escapeText(widget.label ?? widget.kind)
  switch (widget.kind) {
    case 'text-input':
      return `<label class="as-field">${label}<input class="as-input"${id}${bindAttr} /></label>`
    case 'checkbox':
      return `<label class="as-field"><input type="checkbox" class="as-input"${id}${bindAttr} /> ${label}</label>`
    case 'select': {
      const opts = (widget.options ?? []).map((o) => `<option>${escapeText(o)}</option>`).join('')
      return `<label class="as-field">${label}<select class="as-select"${id}${bindAttr}>${opts}</select></label>`
    }
    case 'button':
      return `<button class="as-btn as-btn-primary"${id}${process}${nav}${bindAttr}>${label}</button>`
    case 'navigation':
      return `<button class="as-btn"${id}${nav || process}>${label}</button>`
    case 'table':
      return `<table class="as-table"${id}${bindAttr}><thead><tr><th>${label}</th></tr></thead><tbody></tbody></table>`
    case 'list':
      return `<ul class="as-list"${id}${bindAttr}><li>${label}</li></ul>`
    case 'section':
      return `<div class="as-card"${id}><h2 class="as-title">${label}</h2></div>`
    default:
      return `<p class="as-muted"${id}>${label}</p>`
  }
}

function screenHtml(screen: GuiScreen): string {
  const process = screen.triggersProcess ? ` data-process="${escapeAttr(screen.triggersProcess)}"` : ''
  const title = escapeText(screen.title ?? screen.name)
  const desc = screen.description?.trim()
    ? `<p class="as-muted">${escapeText(screen.description.trim())}</p>`
    : ''
  const widgets = (screen.widgets ?? []).map(widgetHtml).join('\n      ')
  return `  <section class="as-screen" id="${escapeAttr(screen.id)}" data-screen="${escapeAttr(screen.name)}"${process}>
    <h1 class="as-title">${title}</h1>
    ${desc}
    <div class="as-stack as-gap-md">
      ${widgets}
    </div>
  </section>`
}

export function migrateYamlDocument(doc: {
  meta?: { id?: string; title?: string; informalTarget?: string }
  gui?: GuiSection
}): string {
  const app = doc.gui?.app?.name?.trim() || 'App'
  const screens = doc.gui?.screens ?? []
  if (!screens.length) return emptyGuiHtml(app)
  return `<div class="as-app" data-app="${escapeAttr(app)}">
${screens.map(screenHtml).join('\n')}
</div>
`
}

export function tryParseYamlGui(source: string): { html: string; meta: GuiDocument['meta'] } | null {
  try {
    const raw = parseYaml(source)
    if (!isRecord(raw) || !raw.gui) return null
    const gui = raw.gui as GuiSection
    if (!gui.app || !Array.isArray(gui.screens)) return null
    const meta = isRecord(raw.meta)
      ? {
          id: String((raw.meta as { id?: string }).id ?? 'gui'),
          title: String((raw.meta as { title?: string }).title ?? 'GUI'),
          informalTarget: (raw.meta as { informalTarget?: string }).informalTarget
        }
      : { id: 'gui', title: 'GUI' }
    return { html: migrateYamlDocument({ meta, gui }), meta }
  } catch {
    return null
  }
}
