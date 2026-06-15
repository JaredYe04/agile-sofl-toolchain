import type {
  GuiDocument,
  GuiDiagnostic,
  InformalProcessRef,
  InformalVariableRef
} from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function collectIds(document: GuiDocument): Map<string, string> {
  const ids = new Map<string, string>()
  for (const screen of document.gui.screens) {
    if (ids.has(screen.id)) {
      ids.set(screen.id, 'duplicate')
    } else {
      ids.set(screen.id, 'screen')
    }
    for (const w of screen.widgets ?? []) {
      if (ids.has(w.id)) {
        ids.set(w.id, 'duplicate')
      } else {
        ids.set(w.id, 'widget')
      }
    }
  }
  return ids
}

export function validateGuiSpec(
  document: GuiDocument,
  options?: {
    processRefs?: InformalProcessRef[]
    variableRefs?: InformalVariableRef[]
  }
): GuiDiagnostic[] {
  const diagnostics: GuiDiagnostic[] = []

  if (document.guispecVersion !== '1.0') {
    diagnostics.push(
      createDiagnostic(DiagnosticCodes.SCHEMA_ERROR, 'guispecVersion must be "1.0"', 'error', 'guispecVersion')
    )
  }

  if (!document.meta || !isNonEmptyString(document.meta.id) || !isNonEmptyString(document.meta.title)) {
    diagnostics.push(
      createDiagnostic(DiagnosticCodes.SCHEMA_ERROR, 'meta.id and meta.title are required', 'error', 'meta')
    )
  }

  if (!document.gui?.app?.name?.trim()) {
    diagnostics.push(
      createDiagnostic(DiagnosticCodes.SCHEMA_ERROR, 'gui.app.name is required', 'error', 'gui.app.name')
    )
  }

  const ids = collectIds(document)
  for (const [id, kind] of ids) {
    if (kind === 'duplicate') {
      diagnostics.push(
        createDiagnostic(DiagnosticCodes.STYLE_DUPLICATE_ID, `Duplicate id '${id}'`, 'error', id)
      )
    }
  }

  const processIds = new Set(options?.processRefs?.map((p) => p.id) ?? [])
  const screenIds = new Set(document.gui.screens.map((s) => s.id))

  for (const screen of document.gui.screens) {
    const hasContent =
      Boolean(screen.description?.trim()) ||
      Boolean(screen.title?.trim()) ||
      (screen.widgets?.length ?? 0) > 0
    if (!hasContent) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_NO_SCREEN_CONTENT,
          `Screen '${screen.name}' has no widgets or description`,
          'warning',
          `gui.screens.${screen.id}`
        )
      )
    }

    if (screen.triggersProcess && processIds.size > 0 && !processIds.has(screen.triggersProcess)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_PROCESS,
          `triggersProcess '${screen.triggersProcess}' not found in linked informal spec`,
          'warning',
          `gui.screens.${screen.id}.triggersProcess`
        )
      )
    }
  }

  for (const flow of document.gui.flows ?? []) {
    if (!screenIds.has(flow.from)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_FLOW_SCREEN,
          `Flow 'from' references unknown screen '${flow.from}'`,
          'warning',
          `gui.flows.from.${flow.from}`
        )
      )
    }
    if (!screenIds.has(flow.to)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_FLOW_SCREEN,
          `Flow 'to' references unknown screen '${flow.to}'`,
          'warning',
          `gui.flows.to.${flow.to}`
        )
      )
    }
  }

  return diagnostics
}
