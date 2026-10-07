/**
 * Deterministic, block-randomised run schedule and stop-time helpers for the batch runner.
 * The schedule (and the seed that reproduces it) unblinds the runs: it is stored ONLY in the key file.
 */

/** mulberry32: small deterministic 32-bit PRNG, uniform in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const MAX_SEED = 0xffffffff
export function parseSeed(s: string): number {
  if (!/^\d+$/.test(s.trim()) || Number(s) > MAX_SEED) throw new Error(`--seed must be an integer 0..${MAX_SEED} (got '${s}')`)
  return Number(s)
}

export interface ScheduleItem { order: number; block: number; system: string; condition: string; repeat: number }

export const PRNG_NAME = 'mulberry32'
/**
 * Block-randomised design: one block per repeat; each block contains every (system, condition) pair exactly
 * once, in an order permuted (Fisher-Yates) with the seeded PRNG. Block k holds repeat k of every pair, so any
 * prefix that ends on a block boundary is perfectly balanced and an interruption skews by at most one block.
 */
export function blockSchedule(systems: string[], conditions: string[], repeats: number, seed: number): ScheduleItem[] {
  const rnd = mulberry32(seed)
  const pairs = systems.flatMap((system) => conditions.map((condition) => ({ system, condition })))
  const out: ScheduleItem[] = []
  for (let b = 1; b <= repeats; b++) {
    const p = [...pairs]
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j]!, p[i]!] }
    for (const x of p) out.push({ order: out.length + 1, block: b, ...x, repeat: b })
  }
  return out
}

export function blockDesign(systems: string[], conditions: string[], repeats: number, seed: number) {
  return {
    type: 'block-randomised', prng: PRNG_NAME, shuffle: 'Fisher-Yates per block', seed,
    blockSize: systems.length * conditions.length, blocks: repeats,
    description: 'block k = repeat k of every (system, condition) pair, permuted with the seeded PRNG'
  }
}

/** Next local occurrence of HH:MM strictly after `start` (today if still ahead, else tomorrow). */
export function stopDate(hhmm: string, start: Date): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`--stop-at must be HH:MM local time (got '${hhmm}')`)
  const d = new Date(start)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (d.getTime() <= start.getTime()) d.setDate(d.getDate() + 1)
  return d
}
