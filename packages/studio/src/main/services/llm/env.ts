import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function applyEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return
  const parsed = parseEnv(readFileSync(filePath, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}

export function loadStudioEnv(): void {
  const files = [
    join(process.cwd(), '.env'),
    join(app.getAppPath(), '.env'),
    join(app.getAppPath(), '../.env'),
    join(app.getAppPath(), '../../.env')
  ]
  try {
    files.unshift(join(app.getAppPath(), 'packages/studio/.env'))
  } catch {
    /* ignore */
  }
  for (const file of files) applyEnvFile(file)
}

export function getEnvLlmFallback(): { apiKey: string; baseUrl: string; model: string } {
  loadStudioEnv()
  return {
    apiKey: process.env.ECNU_API_KEY?.trim() || '',
    baseUrl: (process.env.ECNU_API_BASE_URL || 'https://chat.ecnu.edu.cn/open/api/v1').replace(/\/$/, ''),
    model: process.env.ECNU_MODEL || 'ecnu-max'
  }
}
