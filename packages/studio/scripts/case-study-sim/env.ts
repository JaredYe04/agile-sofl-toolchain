import { existsSync, readFileSync } from 'node:fs'
import { CHAT_ECNU_BASE, MODEL_ALIASES } from './constants'

/** Load KEY=VALUE lines into process.env (do not override existing). Never print values. */
export function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const k = t.slice(0, t.indexOf('=')).trim()
    let v = t.slice(t.indexOf('=') + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && !process.env[k]) process.env[k] = v
  }
  return true
}

export function loadSimEnv(paths: string[]): string[] {
  const loaded: string[] = []
  for (const p of paths) {
    if (p && loadEnvFile(p)) loaded.push(p)
  }
  if (!process.env.ECNU_API_KEY && process.env.ecnu_api_key) {
    process.env.ECNU_API_KEY = process.env.ecnu_api_key
  }
  if (!process.env.ECNU_API_BASE_URL) process.env.ECNU_API_BASE_URL = CHAT_ECNU_BASE
  if (!process.env.ECNU_MODEL) process.env.ECNU_MODEL = 'ecnu-max'
  return loaded
}

export function resolveApiKey(): string {
  return (process.env.ECNU_API_KEY || process.env.ecnu_api_key || '').trim()
}

export function resolveModel(): { alias: string; modelId: string } {
  const alias = (process.env.ECNU_MODEL || 'ecnu-max').trim()
  return { alias, modelId: MODEL_ALIASES[alias] ?? alias }
}

export function missingKeyError(): Error {
  return new Error(
    'ECNU_API_KEY missing. Set ECNU_API_KEY (or ecnu_api_key) in the environment, packages/studio/.env.ecnu, or packages/studio/.env. Copy empty placeholders from .env.example. Do not commit keys.'
  )
}

/** Redact a known secret from stdout/stderr. No-op when key is empty. */
export function redactStreams(key: string): void {
  if (!key) return
  for (const stream of [process.stdout, process.stderr]) {
    const w = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) =>
      w(typeof chunk === 'string' ? chunk.split(key).join('[redacted]') : chunk, ...(rest as []))) as typeof stream.write
  }
}
