#!/usr/bin/env node
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(studioRoot, '../..')

const lspSrc = join(repoRoot, 'packages', 'language-server', 'dist')
const lspDest = join(studioRoot, 'resources', 'language-server')

if (!existsSync(join(lspSrc, 'server.js'))) {
  console.error('Missing language-server dist/server.js — run prepare:dist first')
  process.exit(1)
}

rmSync(lspDest, { recursive: true, force: true })
mkdirSync(lspDest, { recursive: true })
cpSync(lspSrc, lspDest, { recursive: true })
console.log('Staged language server -> resources/language-server')
