import type { CommandCenterContext, CommandCenterItem, CommandCenterProvider } from '../types'
import { useDocumentDiagnosticsStore } from '../../stores/documentDiagnostics'

export const diagnosticsProvider: CommandCenterProvider = {
  id: 'diagnostics',
  prefix: '!',
  priority: 10,
  isEnabled: (ctx) => ctx.activeTab?.kind === 'document',
  query(query, ctx) {
    const store = useDocumentDiagnosticsStore()
    const needle = query.toLowerCase()
    const items: CommandCenterItem[] = []

    for (const diag of store.unified) {
      const text = `${diag.code} ${diag.message}`.toLowerCase()
      if (needle && !text.includes(needle)) continue

      items.push({
        id: `diag:${diag.span.start}:${diag.code}`,
        kind: 'diagnostic',
        label: diag.message,
        detail: `${diag.code} · L${diag.span.line}`,
        badge: diag.severity,
        group: 'commandCenter.group.diagnostics',
        score: diag.severity === 'error' ? 50 : 30,
        execute: () => {
          ctx.revealSpan(diag.span)
        }
      })
    }

    if (!items.length && !needle) {
      items.push({
        id: 'diag:none',
        kind: 'help',
        label: ctx.t('commandCenter.noDiagnostics'),
        group: 'commandCenter.group.diagnostics',
        score: 1,
        execute: () => {}
      })
    }

    return items
  }
}
