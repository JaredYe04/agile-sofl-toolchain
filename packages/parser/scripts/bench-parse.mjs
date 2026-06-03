/**
 * Parse benchmark: P95 latency for representative Agile-SOFL fixtures.
 * Run after `npm run build`.
 *
 * Usage:
 *   node scripts/bench-parse.mjs
 *   node scripts/bench-parse.mjs --assert-p95=100   # fail if banking P95 exceeds 100ms
 *   node scripts/bench-parse.mjs --assert-p95=100 --assert-ecommerce-p95=150
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { parse } from '../dist/index.js'

const parserRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(parserRoot, '..', '..')

const assertArg = process.argv.find((a) => a.startsWith('--assert-p95='))
const assertP95Ms = assertArg ? Number(assertArg.split('=')[1]) : undefined
const assertEcommerceArg = process.argv.find((a) => a.startsWith('--assert-ecommerce-p95='))
const assertEcommerceP95Ms = assertEcommerceArg ? Number(assertEcommerceArg.split('=')[1]) : undefined

const fixtures = [
  {
    name: 'banking',
    path: join(parserRoot, 'tests', 'fixtures', 'integration', 'banking.asfl')
  },
  {
    name: 'ecommerce',
    path: join(repoRoot, 'examples', 'ecommerce.asfl')
  },
  {
    name: 'keyword-traps',
    path: join(repoRoot, 'examples', 'keyword-traps.asfl')
  }
]

const WARMUP = 5
const ITERATIONS = 50
const P95_INDEX = Math.ceil(ITERATIONS * 0.95) - 1

function percentile(sortedMs, index) {
  return sortedMs[Math.min(Math.max(index, 0), sortedMs.length - 1)]
}

function benchParse(source) {
  for (let i = 0; i < WARMUP; i++) parse(source)
  const samples = []
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now()
    parse(source)
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  return {
    minMs: samples[0],
    medianMs: percentile(samples, Math.floor(ITERATIONS / 2)),
    p95Ms: percentile(samples, P95_INDEX),
    maxMs: samples[samples.length - 1]
  }
}

const results = []
for (const fixture of fixtures) {
  const source = readFileSync(fixture.path, 'utf-8')
  const stats = benchParse(source)
  results.push({ fixture: fixture.name, bytes: source.length, ...stats })
}

const summary = {
  iterations: ITERATIONS,
  warmup: WARMUP,
  p95Index: P95_INDEX + 1,
  results
}

console.log('parse-benchmark', JSON.stringify(summary, null, 2))

if (assertP95Ms !== undefined) {
  const banking = results.find((r) => r.fixture === 'banking')
  if (!banking) {
    console.error(`assert-p95: banking fixture not found`)
    process.exit(1)
  }
  if (banking.p95Ms > assertP95Ms) {
    console.error(
      `assert-p95: banking P95 ${banking.p95Ms.toFixed(2)}ms exceeds limit ${assertP95Ms}ms`
    )
    process.exit(1)
  }
  console.log(`assert-p95: banking P95 ${banking.p95Ms.toFixed(2)}ms <= ${assertP95Ms}ms OK`)
}

if (assertEcommerceP95Ms !== undefined) {
  const ecommerce = results.find((r) => r.fixture === 'ecommerce')
  if (!ecommerce) {
    console.error(`assert-ecommerce-p95: ecommerce fixture not found`)
    process.exit(1)
  }
  if (ecommerce.p95Ms > assertEcommerceP95Ms) {
    console.error(
      `assert-ecommerce-p95: ecommerce P95 ${ecommerce.p95Ms.toFixed(2)}ms exceeds limit ${assertEcommerceP95Ms}ms`
    )
    process.exit(1)
  }
  console.log(
    `assert-ecommerce-p95: ecommerce P95 ${ecommerce.p95Ms.toFixed(2)}ms <= ${assertEcommerceP95Ms}ms OK`
  )
}
