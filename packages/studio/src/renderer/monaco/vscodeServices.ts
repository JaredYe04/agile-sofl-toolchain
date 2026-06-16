import { initServices } from 'monaco-languageclient/vscode/services'

let servicesReady: Promise<void> | null = null

/** Required once before MonacoLanguageClient.start() (monaco-languageclient v8+). */
export function ensureVscodeServices(): Promise<void> {
  if (!servicesReady) {
    servicesReady = initServices({ caller: 'agile-sofl-studio' })
  }
  return servicesReady
}
