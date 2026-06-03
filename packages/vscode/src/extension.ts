import * as path from 'node:path'
import {
  languages,
  workspace,
  window,
  ExtensionContext,
  TextEdit,
  Range,
  DocumentSelector,
  TextDocument,
  TextEditor,
  TextEditorDecorationType,
  DecorationRangeBehavior,
  ThemeColor
} from 'vscode'
import { format as formatAsfl, parse, collectHybridRegions } from '@agile-sofl/parser'
import type { HybridRegion } from '@agile-sofl/parser'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node.js'

let client: LanguageClient | undefined

const documentSelector: DocumentSelector = [
  { language: 'agile-sofl', scheme: 'file' },
  { pattern: '**/*.asfl', scheme: 'file' }
]

let fsfDecorationType: TextEditorDecorationType
let informalDecorationType: TextEditorDecorationType
let commentDecorationType: TextEditorDecorationType
let decomDecorationType: TextEditorDecorationType

const hybridDebounceMs = 300
const decorationTimers = new Map<string, ReturnType<typeof setTimeout>>()

function spanToRange(document: TextDocument, span: { start: number; end: number }): Range {
  return new Range(document.positionAt(span.start), document.positionAt(span.end))
}

function rangesForType(
  document: TextDocument,
  regions: HybridRegion[],
  type: HybridRegion['type']
): Range[] {
  return regions.filter((r) => r.type === type).map((r) => spanToRange(document, r.span))
}

function applyHybridDecorations(editor: TextEditor): void {
  const document = editor.document
  if (document.languageId !== 'agile-sofl') return

  const { ast } = parse(document.getText())
  if (!ast || ast.type !== 'program') {
    editor.setDecorations(fsfDecorationType, [])
    editor.setDecorations(informalDecorationType, [])
    editor.setDecorations(commentDecorationType, [])
    editor.setDecorations(decomDecorationType, [])
    return
  }

  const regions = collectHybridRegions(ast)
  editor.setDecorations(fsfDecorationType, rangesForType(document, regions, 'fsf'))
  editor.setDecorations(informalDecorationType, rangesForType(document, regions, 'informal'))
  editor.setDecorations(commentDecorationType, rangesForType(document, regions, 'comment'))
  editor.setDecorations(decomDecorationType, rangesForType(document, regions, 'decom'))
}

function scheduleHybridDecorations(editor: TextEditor): void {
  const key = editor.document.uri.toString()
  const existing = decorationTimers.get(key)
  if (existing) clearTimeout(existing)
  decorationTimers.set(
    key,
    setTimeout(() => {
      decorationTimers.delete(key)
      if (editor.document.uri.toString() === key) {
        applyHybridDecorations(editor)
      }
    }, hybridDebounceMs)
  )
}

function refreshVisibleHybridDecorations(): void {
  for (const editor of window.visibleTextEditors) {
    if (editor.document.languageId === 'agile-sofl') {
      scheduleHybridDecorations(editor)
    }
  }
}

function provideFormatting(document: TextDocument): TextEdit[] | undefined {
  const source = document.getText()
  const { source: formatted, diagnostics } = formatAsfl(source)
  if (diagnostics.some((d) => d.severity === 'error')) {
    return undefined
  }
  if (formatted === source) {
    return undefined
  }
  const lastLineIndex = document.lineCount - 1
  const lastLine = document.lineAt(lastLineIndex)
  const fullRange = new Range(0, 0, lastLineIndex, lastLine.text.length)
  return [TextEdit.replace(fullRange, formatted)]
}

export function activate(context: ExtensionContext): void {
  fsfDecorationType = window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new ThemeColor('charts.blue'),
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
  })
  informalDecorationType = window.createTextEditorDecorationType({
    backgroundColor: 'rgba(206, 145, 120, 0.15)',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
  })
  commentDecorationType = window.createTextEditorDecorationType({
    backgroundColor: 'rgba(106, 153, 85, 0.12)',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
  })
  decomDecorationType = window.createTextEditorDecorationType({
    backgroundColor: 'rgba(215, 186, 125, 0.12)',
    rangeBehavior: DecorationRangeBehavior.ClosedClosed
  })

  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6010'] }
    }
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: 'agileSofl',
      fileEvents: workspace.createFileSystemWatcher('**/*.asfl')
    },
    initializationOptions: {
      semanticHighlighting: true
    }
  }

  client = new LanguageClient('agileSofl', 'Agile-SOFL Language Server', serverOptions, clientOptions)
  context.subscriptions.push(client)
  void client.start()

  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider(documentSelector, {
      provideDocumentFormattingEdits(document) {
        return provideFormatting(document)
      }
    })
  )

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor) scheduleHybridDecorations(editor)
    }),
    workspace.onDidChangeTextDocument((event) => {
      const editor = window.visibleTextEditors.find((e) => e.document === event.document)
      if (editor) scheduleHybridDecorations(editor)
    }),
    workspace.onDidOpenTextDocument(() => refreshVisibleHybridDecorations())
  )

  context.subscriptions.push(
    fsfDecorationType,
    informalDecorationType,
    commentDecorationType,
    decomDecorationType
  )

  refreshVisibleHybridDecorations()
}

export function deactivate(): Thenable<void> | undefined {
  for (const timer of decorationTimers.values()) {
    clearTimeout(timer)
  }
  decorationTimers.clear()
  if (!client) return undefined
  return client.stop()
}
