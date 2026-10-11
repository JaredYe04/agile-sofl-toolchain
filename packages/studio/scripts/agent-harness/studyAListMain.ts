/** Entry for the list-only harness bundle. Loading this file lists scenarios and does not start the agent. */
import { printStudyAList } from './studyAList'

try {
  printStudyAList()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit((error as { exitCode?: number }).exitCode ?? 1)
}
