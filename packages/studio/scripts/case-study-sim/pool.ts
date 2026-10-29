import { MAX_WORKERS } from './constants'

export function clampConcurrency(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(MAX_WORKERS, Math.floor(n))
}

/**
 * Run `items` with at most `limit` workers (hard-capped at MAX_WORKERS).
 * Each worker awaits one item fully before taking the next, so HTTP inside a
 * subject stays serial; only different subjects overlap.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = clampConcurrency(limit)
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i]!, i)
    }
  }
  const workers = Array.from({ length: Math.min(n, items.length) }, () => worker())
  await Promise.all(workers)
  return out
}
