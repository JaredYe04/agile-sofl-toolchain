import * as path from 'node:path'
import {
  languages,
  workspace,
  ExtensionContext,
  TextEdit,
  Range,
  DocumentSelector,
  TextDocument
} from 'vscode'
import { format as formatAsfl } from '@agile-sofl/parser'
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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined
  return client.stop()
}
