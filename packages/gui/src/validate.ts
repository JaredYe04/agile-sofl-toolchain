import type {
  GuiDocument,
  GuiDiagnostic,
  HybridProcessRef,
  InformalProcessRef,
  InformalVariableRef
} from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'

function processKey(moduleName: string, processName: string): string {
  return `${moduleName}.${processName}`
}

function processMatches(ref: string, processes: HybridProcessRef[] | InformalProcessRef[]): boolean {
  const needle = ref.trim()
  if (!needle) return false
  for (const p of processes) {
    if ('processName' in p) {
      if (p.processName === needle) return true
      if (processKey(p.moduleName, p.processName) === needle) return true
      if (`${p.moduleName}.${p.processName}`.toLowerCase() === needle.toLowerCase()) return true
    } else if (p.id === needle || p.name === needle) {
      return true
    }
  }
  return false
}

export function validateGuiSpec(
  document: GuiDocument,
  options?: {
    processRefs?: InformalProcessRef[]
    variableRefs?: InformalVariableRef[]
    hybridProcesses?: HybridProcessRef[]
  }
): GuiDiagnostic[] {
  const diagnostics: GuiDiagnostic[] = []
  const ids = new Map<string, string>()
  const screenIds = new Set(document.gui.screens.map((s) => s.id))
  const screenNames = new Set(document.gui.screens.map((s) => s.name))

  if (!document.gui.app.name.trim()) {
    diagnostics.push(
      createDiagnostic(DiagnosticCodes.SCHEMA_ERROR, 'data-app (application name) is required', 'error', 'data-app')
    )
  }

  if (!document.gui.screens.length) {
    diagnostics.push(createDiagnostic(DiagnosticCodes.STYLE_NO_SCREEN_CONTENT, 'No data-screen sections found', 'warning'))
  }

  for (const screen of document.gui.screens) {
    if (ids.has(screen.id)) {
      diagnostics.push(
        createDiagnostic(DiagnosticCodes.STYLE_DUPLICATE_ID, `Duplicate screen id '${screen.id}'`, 'error', screen.id)
      )
    } else {
      ids.set(screen.id, 'screen')
    }
    const hasContent = Boolean(screen.title?.trim()) || (screen.widgets?.length ?? 0) > 0
    if (!hasContent) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_NO_SCREEN_CONTENT,
          `Screen '${screen.name}' has no widgets or title`,
          'warning',
          screen.id
        )
      )
    }
    const processRefs = options?.hybridProcesses ?? options?.processRefs ?? []
    if (screen.triggersProcess && processRefs.length > 0 && !processMatches(screen.triggersProcess, processRefs)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_PROCESS,
          `data-process '${screen.triggersProcess}' not found in Hybrid/Informal processes`,
          'warning',
          `${screen.id}.data-process`
        )
      )
    }
    for (const widget of screen.widgets ?? []) {
      if (ids.has(widget.id)) {
        diagnostics.push(
          createDiagnostic(DiagnosticCodes.STYLE_DUPLICATE_ID, `Duplicate id '${widget.id}'`, 'error', widget.id)
        )
      } else {
        ids.set(widget.id, 'widget')
      }
      if (widget.process && processRefs.length > 0 && !processMatches(widget.process, processRefs)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.STYLE_UNKNOWN_PROCESS,
            `data-process '${widget.process}' not found`,
            'warning',
            widget.id
          )
        )
      }
      const bind = widget.binds
      if (bind && options?.hybridProcesses?.length) {
        const proc = options.hybridProcesses.find(
          (p) =>
            widget.process === p.processName ||
            widget.process === `${p.moduleName}.${p.processName}` ||
            screen.triggersProcess === p.processName ||
            screen.triggersProcess === `${p.moduleName}.${p.processName}`
        )
        if (proc) {
          if (bind.param && !proc.inputs.includes(bind.param)) {
            diagnostics.push(
              createDiagnostic(
                DiagnosticCodes.UNKNOWN_BIND,
                `data-bind param:${bind.param} is not an input of ${proc.moduleName}.${proc.processName}`,
                'warning',
                widget.id
              )
            )
          }
          if (bind.out && !proc.outputs.includes(bind.out)) {
            diagnostics.push(
              createDiagnostic(
                DiagnosticCodes.UNKNOWN_BIND,
                `data-bind out:${bind.out} is not an output of ${proc.moduleName}.${proc.processName}`,
                'warning',
                widget.id
              )
            )
          }
          if (bind.variable && !proc.vars.includes(bind.variable)) {
            diagnostics.push(
              createDiagnostic(
                DiagnosticCodes.UNKNOWN_BIND,
                `data-bind var:${bind.variable} is not a module variable`,
                'warning',
                widget.id
              )
            )
          }
        }
      }
    }
  }

  for (const flow of document.gui.flows ?? []) {
    const known = (id: string) => screenIds.has(id) || screenNames.has(id)
    if (!known(flow.from)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_FLOW_SCREEN,
          `data-nav source screen '${flow.from}' is unknown`,
          'warning',
          flow.from
        )
      )
    }
    if (!known(flow.to)) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.STYLE_UNKNOWN_FLOW_SCREEN,
          `data-nav target '${flow.to}' is unknown`,
          'warning',
          flow.to
        )
      )
    }
  }

  return diagnostics
}
