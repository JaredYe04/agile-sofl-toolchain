import * as path from 'node:path'
import { workspace, ExtensionContext } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node.js'

let client: LanguageClient | undefined

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
    documentSelector: [{ scheme: 'file', language: 'agile-sofl' }],
    synchronize: {
      configurationSection: 'agileSofl',
      fileEvents: workspace.createFileSystemWatcher('**/*.asfl')
    }
  }

  client = new LanguageClient('agileSofl', 'Agile-SOFL Language Server', serverOptions, clientOptions)
  context.subscriptions.push(client)
  void client.start()
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined
  return client.stop()
}
