import type { GuiDocument, GuiDocumentModel } from './model.js'
import { parseGuiSpec } from './parse.js'
import { buildGuiModel } from './buildGuiModel.js'
import { findElements, innerText, parseHtmlFragment, type HtmlNode } from './html.js'

function clip(text: string, n: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= n) return compact
  return `${compact.slice(0, Math.max(0, n - 1))}…`
}

function outlineNode(node: HtmlNode, depth: number, budget: { left: number }): string[] {
  if (budget.left <= 0 || node.type !== 'element' || node.tag === '#root') return []
  budget.left -= 1
  const cls = (node.attrs.class ?? '').split(/\s+/).filter(Boolean)
  const id = node.attrs.id ? `#${node.attrs.id}` : ''
  const extra = [
    node.attrs['data-process'] ? `process ${node.attrs['data-process']}` : '',
    node.attrs['data-nav'] ? `nav ${node.attrs['data-nav']}` : '',
    node.attrs['data-bind'] ? `bind ${node.attrs['data-bind']}` : ''
  ]
    .filter(Boolean)
    .join(', ')
  const label = clip(innerText(node), 36)
  const classText = cls.length ? `.${cls.join('.')}` : ''
  const line = `${'  '.repeat(depth)}- <${node.tag}>${id}${classText}${extra ? ` — ${extra}` : ''}${label ? ` "${label}"` : ''}`
  const lines = [line]
  for (const child of node.children) {
    if (child.type === 'element') lines.push(...outlineNode(child, depth + 1, budget))
  }
  return lines
}

function screenOutline(html: string | undefined, screenName: string): string[] {
  if (!html?.trim()) return []
  const root = parseHtmlFragment(html)
  const screen =
    findElements(root, (n) => n.attrs['data-screen'] === screenName || n.attrs.id === screenName)[0]
  if (!screen) return []
  const budget = { left: 48 }
  const lines: string[] = []
  for (const child of screen.children) {
    if (child.type === 'element') lines.push(...outlineNode(child, 1, budget))
  }
  return lines
}

export function formatGuiInventory(source: string, maxChars = 12000): string {
  const model = buildGuiModel(source)
  return formatGuiModelInventory(model, maxChars)
}

export function formatGuiModelInventory(model: GuiDocumentModel, maxChars = 12000): string {
  if (!model.screens.length) return '(empty GUI specification)'
  const lines: string[] = [
    `# GUI ${model.app.name || model.meta.title}`,
    'Design complete product screens (shell, hero, cards, forms, lists), not a handful of isolated buttons.'
  ]
  for (const screen of model.screens) {
    lines.push(`## screen:${screen.name} [${screen.id}]`)
    if (screen.triggersProcess) lines.push(`- process: ${screen.triggersProcess}`)
    const outline = screenOutline(model.html, screen.name)
    if (outline.length) {
      lines.push('- structure:')
      lines.push(...outline)
    }
    for (const w of screen.widgets ?? []) {
      const bind = w.binds
        ? Object.entries(w.binds)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
        : ''
      const extra = [w.process ? `process ${w.process}` : '', w.nav ? `nav ${w.nav}` : '', bind]
        .filter(Boolean)
        .join(', ')
      lines.push(`- ${w.id} (${w.kind}) ${w.label ?? ''}${extra ? ` — ${extra}` : ''}`)
    }
    lines.push('')
  }
  const text = lines.join('\n').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…(truncated)`
}

export function numberedGuiSource(source: string): string {
  return source.split(/\r?\n/).map((line, i) => `${String(i + 1).padStart(4, ' ')}| ${line}`).join('\n')
}

export function parseGuiDocument(source: string): GuiDocument | null {
  return parseGuiSpec(source).document
}
