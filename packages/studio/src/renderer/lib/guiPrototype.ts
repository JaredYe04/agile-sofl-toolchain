function readThemeVars(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement)
  const names = [
    '--gui-canvas',
    '--gui-surface-card',
    '--gui-ink',
    '--gui-body',
    '--gui-muted',
    '--gui-hairline',
    '--gui-primary',
    '--accent',
    '--accent-fg',
    '--danger',
    '--field-bg',
    '--surface-base',
    '--surface-raised',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--border-subtle'
  ]
  const vars: Record<string, string> = {}
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim()
    if (value) vars[name] = value
  }
  return vars
}

export { readThemeVars }

export type GuiProcessEvent = {
  process: string
  env: Record<string, string | number | boolean | null>
  nav?: string
  screen?: string
}

export function collectEnv(root: ParentNode): Record<string, string | number | boolean | null> {
  const env: Record<string, string | number | boolean | null> = {}
  root.querySelectorAll('[data-bind]').forEach((el) => {
    const bind = el.getAttribute('data-bind') ?? ''
    const value =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
        ? el.type === 'checkbox'
          ? (el as HTMLInputElement).checked
          : el.value
        : el.textContent?.trim() ?? ''
    for (const part of bind.split('|')) {
      const name = part.split(':')[1]?.trim()
      if (name) env[name] = value
    }
  })
  return env
}

export function applyEnv(root: ParentNode, env: Record<string, string | number | boolean | null>): void {
  root.querySelectorAll('[data-bind]').forEach((el) => {
    const bind = el.getAttribute('data-bind') ?? ''
    const parts = bind.split('|').map((p) => p.trim())
    const out = parts.find((p) => p.startsWith('out:') || p.startsWith('display:') || p.startsWith('var:'))
    const name = out?.split(':')[1]
    if (!name || !(name in env)) return
    const value = env[name]
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      if (el.type === 'checkbox') (el as HTMLInputElement).checked = Boolean(value)
      else el.value = String(value ?? '')
    } else {
      el.textContent = String(value ?? '')
    }
  })
}

export function showScreen(root: ParentNode, screenId: string): void {
  root.querySelectorAll('[data-screen]').forEach((el) => {
    const id = el.getAttribute('data-screen') || el.id
    el.classList.toggle('is-hidden', id !== screenId && el.id !== screenId)
  })
}

export function pathOfElement(target: Element, shadow: ShadowRoot): string | null {
  const app = shadow.querySelector('.as-app') ?? [...shadow.children].find((c) => c.tagName !== 'STYLE')
  if (!app) return null
  if (target === app) return '0'
  const parts: number[] = []
  let el: Element | null = target
  while (el && el !== app) {
    const parent = el.parentElement
    if (!parent) return null
    parts.unshift([...parent.children].indexOf(el))
    el = parent
  }
  return ['0', ...parts].join('.')
}
