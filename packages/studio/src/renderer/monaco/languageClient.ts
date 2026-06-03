import { MonacoLanguageClient } from 'monaco-languageclient'
import {
  CloseAction,
  ErrorAction,
  type MessageTransports
} from 'vscode-languageclient/browser'
import { AbstractMessageReader, AbstractMessageWriter, type DataCallback } from 'vscode-jsonrpc'
import { monaco } from './setup'

class IpcMessageReader extends AbstractMessageReader {
  private disposable: (() => void) | null = null

  listen(callback: DataCallback): void {
    this.disposable = window.studio!.lspOnMessage((msg) => {
      callback(JSON.parse(msg))
    })
  }

  dispose(): void {
    this.disposable?.()
    this.disposable = null
  }
}

class IpcMessageWriter extends AbstractMessageWriter {
  write(msg: unknown): Promise<void> {
    window.studio!.lspSend(JSON.stringify(msg))
    return Promise.resolve()
  }

  end(): void {}
}

let client: MonacoLanguageClient | null = null

export function createLanguageClient(): MonacoLanguageClient {
  const reader = new IpcMessageReader()
  const writer = new IpcMessageWriter()
  const messageTransports: MessageTransports = { reader, writer }

  client = new MonacoLanguageClient({
    name: 'Agile-SOFL Language Client',
    clientOptions: {
      documentSelector: [{ language: 'agile-sofl', scheme: 'file' }, { language: 'agile-sofl', scheme: 'inmemory' }],
      initializationOptions: { semanticHighlighting: true },
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart })
      }
    },
    messageTransports
  })

  return client
}

export async function startLanguageClient(): Promise<MonacoLanguageClient | null> {
  if (!window.studio) return null
  const c = client ?? createLanguageClient()
  await c.start()
  return c
}

export function getLanguageClient(): MonacoLanguageClient | null {
  return client
}

export function uriForTab(tabUri: string): monaco.Uri {
  if (tabUri.startsWith('inmemory://')) {
    return monaco.Uri.parse(tabUri)
  }
  return monaco.Uri.parse(tabUri)
}
