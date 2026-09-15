/** Restricted HTML5 dialect for Agile-SOFL GUI specifications. */

export const GUI_HTML_VERSION = 'html-1'

export const ALLOWED_TAGS = new Set([
  'div',
  'span',
  'section',
  'header',
  'footer',
  'nav',
  'main',
  'article',
  'aside',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'label',
  'button',
  'input',
  'select',
  'option',
  'textarea',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'ul',
  'ol',
  'li',
  'form',
  'strong',
  'em',
  'small',
  'hr'
])

export const VOID_TAGS = new Set(['input', 'hr'])

export const ALLOWED_ATTRS = new Set([
  'id',
  'class',
  'type',
  'name',
  'placeholder',
  'value',
  'disabled',
  'checked',
  'selected',
  'rows',
  'cols',
  'for',
  'colspan',
  'rowspan',
  'alt',
  'data-app',
  'data-screen',
  'data-process',
  'data-bind',
  'data-nav',
  'data-scenario',
  'data-id'
])

export const ALLOWED_CLASSES = new Set([
  'as-app',
  'as-screen',
  'as-navbar',
  'as-row',
  'as-col',
  'as-grid',
  'as-stack',
  'as-card',
  'as-gap-sm',
  'as-gap-md',
  'as-gap-lg',
  'as-btn',
  'as-btn-primary',
  'as-btn-ghost',
  'as-input',
  'as-select',
  'as-table',
  'as-list',
  'as-field',
  'as-title',
  'as-muted',
  'as-hint',
  'is-hidden'
])

export const DATA_ATTRS = [
  'data-app',
  'data-screen',
  'data-process',
  'data-bind',
  'data-nav',
  'data-scenario',
  'data-id'
] as const

export function isAllowedClass(name: string): boolean {
  return ALLOWED_CLASSES.has(name)
}

export function isAllowedTag(name: string): boolean {
  return ALLOWED_TAGS.has(name.toLowerCase())
}

export function emptyGuiHtml(appName = 'App', screenName = 'Home'): string {
  return `<div class="as-app" data-app="${escapeAttr(appName)}">
  <section class="as-screen" data-screen="${escapeAttr(screenName)}">
    <h1 class="as-title">${escapeText(screenName)}</h1>
    <div class="as-stack as-gap-md"></div>
  </section>
</div>
`
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function looksLikeYamlGui(source: string): boolean {
  const head = source.trimStart().slice(0, 80)
  return (
    head.startsWith('guispecVersion') ||
    /^meta:\s*$/m.test(source.slice(0, 200)) && source.includes('gui:')
  )
}
