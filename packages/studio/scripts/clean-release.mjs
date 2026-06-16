#!/usr/bin/env node
import { rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = join(studioRoot, 'release')

if (!existsSync(releaseDir)) {
  console.log('No release directory to clean')
  process.exit(0)
}

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM "Agile-SOFL Studio.exe" /T', { stdio: 'ignore' })
  } catch {
    /* not running */
  }
}

try {
  rmSync(releaseDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
  console.log('Removed release directory')
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.warn('Could not fully clean release directory. Close Agile-SOFL Studio and retry if packaging fails.')
  console.warn(message)
}
