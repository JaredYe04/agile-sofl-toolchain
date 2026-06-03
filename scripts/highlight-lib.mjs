import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Registry } = require('vscode-textmate')
const { loadWASM, createOnigScanner, createOnigString } = require('vscode-oniguruma')

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

let registryPromise = null

async function getRegistry() {
  if (!registryPromise) {
    registryPromise = (async () => {
      const wasmPath = join(repoRoot, 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm')
      const wasm = readFileSync(wasmPath)
      await loadWASM(wasm.buffer)
      const grammarPath = join(repoRoot, 'packages', 'vscode', 'syntaxes', 'agile-sofl.tmLanguage.json')
      const grammar = JSON.parse(readFileSync(grammarPath, 'utf-8'))
      const scopeMap = JSON.parse(readFileSync(join(__dirname, 'highlight-scope-map.json'), 'utf-8'))
      const registry = new Registry({
        onigLib: Promise.resolve({
          createOnigScanner: (patterns) => createOnigScanner(patterns),
          createOnigString: (str) => createOnigString(str)
        }),
        scopeNameToLanguage: { 'source.asfl': 'agile-sofl' },
        async loadGrammar(scopeName) {
          if (scopeName === 'source.asfl') return grammar
          return null
        }
      })
      return { registry, scopeMap }
    })()
  }
  return registryPromise
}

export function scopeToColorClass(scopes, scopeMap) {
  if (!scopes || scopes.length === 0) return scopeMap.default
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i]
    for (const rule of scopeMap.rules) {
      if (scope === rule.prefix || scope.startsWith(`${rule.prefix}.`)) {
        return rule.colorClass
      }
    }
  }
  return scopeMap.default
}

function mergeTokens(line, tokens, scopeMap) {
  const segments = []
  let lastEnd = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const start = token.startIndex
    const end = i < tokens.length - 1 ? tokens[i + 1].startIndex : line.length
    if (start > lastEnd) {
      segments.push({
        start: lastEnd,
        end: start,
        text: line.slice(lastEnd, start),
        colorClass: 'plain'
      })
    }
    const colorClass = scopeToColorClass(token.scopes, scopeMap)
    segments.push({
      start,
      end,
      text: line.slice(start, end),
      colorClass,
      scopes: token.scopes
    })
    lastEnd = end
  }
  if (lastEnd < line.length) {
    segments.push({
      start: lastEnd,
      end: line.length,
      text: line.slice(lastEnd),
      colorClass: 'plain'
    })
  }
  return segments.filter((s) => s.text.length > 0)
}

export async function highlightSource(source) {
  const { registry, scopeMap } = await getRegistry()
  const grammar = await registry.loadGrammar('source.asfl')
  const lines = source.split(/\r?\n/)
  const result = []
  let ruleStack = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineTokens = grammar.tokenizeLine(line, ruleStack)
    ruleStack = lineTokens.ruleStack
    const segments = mergeTokens(line, lineTokens.tokens, scopeMap)
    result.push({ line: i + 1, text: line, segments })
  }
  return result
}

export function annotateLine(segments) {
  let out = ''
  for (const seg of segments) {
    if (seg.colorClass === 'plain') out += seg.text
    else out += `{${seg.colorClass}}${seg.text}{/${seg.colorClass}}`
  }
  return out
}

export function ansiLine(segments, scopeMap) {
  const reset = '\x1b[0m'
  let out = ''
  for (const seg of segments) {
    const code = scopeMap.ansi[seg.colorClass] ?? scopeMap.ansi.plain
    out += `\x1b[${code}m${seg.text}${reset}`
  }
  return out
}

export function findIdentifierSegments(highlighted, identifier) {
  const matches = []
  for (const row of highlighted) {
    for (const seg of row.segments) {
      if (seg.text === identifier || seg.text.includes(identifier)) {
        matches.push({ line: row.line, segment: seg })
      }
    }
  }
  return matches
}

export function assertIdentifierNotSplit(highlighted, identifier, allowedClasses) {
  for (const row of highlighted) {
    const containing = row.segments.filter((s) => s.text.includes(identifier))
    if (containing.length === 0) continue
    const merged = containing.filter((s) => s.text === identifier)
    if (merged.length === 1) {
      if (!allowedClasses.includes(merged[0].colorClass)) {
        throw new Error(`Identifier "${identifier}" on line ${row.line} has class ${merged[0].colorClass}, expected one of ${allowedClasses.join(', ')}`)
      }
      const split = containing.length > 1 || containing.some((s) => s.text !== identifier)
      if (split) {
        throw new Error(`Identifier "${identifier}" split on line ${row.line}: ${JSON.stringify(containing.map((s) => ({ text: s.text, colorClass: s.colorClass })))}`)
      }
    }
  }
}
