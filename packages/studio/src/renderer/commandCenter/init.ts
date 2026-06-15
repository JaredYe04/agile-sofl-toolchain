import { registerCommandCenterProvider } from './registry'
import { tabsProvider } from './providers/tabsProvider'
import { recentFilesProvider } from './providers/recentFilesProvider'
import { commandsProvider } from './providers/commandsProvider'
import { symbolsProvider } from './providers/symbolsProvider'
import { lineProvider } from './providers/lineProvider'
import { diagnosticsProvider } from './providers/diagnosticsProvider'
import { helpProvider } from './providers/helpProvider'
import { projectFilesProvider } from './providers/projectFilesProvider'

let initialized = false

export function initCommandCenterProviders(): void {
  if (initialized) return
  initialized = true

  registerCommandCenterProvider(tabsProvider)
  registerCommandCenterProvider(recentFilesProvider)
  registerCommandCenterProvider(projectFilesProvider)
  registerCommandCenterProvider(commandsProvider)
  registerCommandCenterProvider(symbolsProvider)
  registerCommandCenterProvider(lineProvider)
  registerCommandCenterProvider(diagnosticsProvider)
  registerCommandCenterProvider(helpProvider)
}
