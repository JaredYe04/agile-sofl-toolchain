import { check, formatDiagnostic } from '@agile-sofl/parser'

declare const monaco: typeof import('monaco-editor')

const SAMPLE = `module SYSTEM_Demo;
process Demo (x: nat): nat
FSF :
x > 0 && x = 1 ||
others && x = 0
comment: informal note for reviewers
end_process
end_module`

const editorEl = document.getElementById('editor')
const statusEl = document.getElementById('status')
const diagnosticsEl = document.getElementById('diagnostics')

if (!editorEl || !statusEl || !diagnosticsEl) {
  throw new Error('Missing demo layout elements')
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function runCheck(source: string): void {
  const result = check(source)
  const errors = result.diagnostics.filter((d) => d.severity === 'error')
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning')

  statusEl.textContent = result.ast
    ? `OK — ${warnings.length} warning(s), ${errors.length} error(s)`
    : `Failed — ${errors.length} error(s)`

  diagnosticsEl.innerHTML = ''
  for (const d of result.diagnostics) {
    const line = document.createElement('div')
    line.className = `diag ${d.severity}`
    line.textContent = formatDiagnostic(d, source)
    diagnosticsEl.appendChild(line)
  }

  const markers = result.diagnostics
    .filter((d) => d.span)
    .map((d) => ({
      severity:
        d.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : d.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      message: d.message,
      startLineNumber: d.span!.line,
      startColumn: d.span!.column,
      endLineNumber: d.span!.line,
      endColumn: d.span!.column + Math.max(1, d.span!.end - d.span!.start)
    }))
  monaco.editor.setModelMarkers(editor.getModel()!, 'agile-sofl', markers)
}

function scheduleCheck(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runCheck(editor.getValue()), 350)
}

const editor = monaco.editor.create(editorEl, {
  value: SAMPLE,
  language: 'plaintext',
  theme: 'vs-dark',
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 14,
  wordWrap: 'on'
})

editor.onDidChangeModelContent(scheduleCheck)
runCheck(editor.getValue())
