import type { Pace, ThinkingSpec } from './types'

/** Production Accept/Reject waits at least this long, even if a model file is edited downward. */
export const PRODUCTION_MIN_MS = 2000

/**
 * Approximate inverse CDF of the standard normal (Acklam).
 * `u` is clamped into (0, 1).
 */
export function inverseStandardNormal(u: number): number {
  const x = Math.min(1 - 1e-12, Math.max(1e-12, u))
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383274122986626e2, -3.066479806614716e1,
    2.506628277459239
  ]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783
  ]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const plow = 0.02425
  const phigh = 1 - plow
  if (x < plow) {
    const q = Math.sqrt(-2 * Math.log(x))
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    )
  }
  if (x > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - x))
    return -(
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    )
  }
  const q = x - 0.5
  const r = q * q
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  )
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Independent stream so each clarification or proposal has a stable draw. */
export function rngFor(seed: number, stream: number): () => number {
  return mulberry32((seed ^ Math.imul(stream + 1, 0x9e3779b1)) >>> 0)
}

export function thinkingMsAt(spec: ThinkingSpec, chars: number, uniform: number): number {
  const median = spec.medianSeconds + spec.secondsPerKChar * (chars / 1000)
  const z = inverseStandardNormal(uniform)
  const seconds = median * Math.exp(spec.sigma * z)
  const clamped = Math.min(spec.maxSeconds, Math.max(spec.minSeconds, seconds))
  return Math.round(clamped * 1000)
}

/**
 * Wall-clock wait.
 * Production sleeps the sampled time, and never less than {@link PRODUCTION_MIN_MS}.
 * Dry-run keeps a seconds-scale wait (1.0–2.2s) so a pilot can finish without a multi-minute pause.
 * The sampled time is still recorded as `intendedThinkingMs`.
 */
export function wallSleepMs(intendedMs: number, pace: Pace): number {
  const intended = Math.max(0, Math.round(intendedMs))
  if (pace === 'production') return Math.max(PRODUCTION_MIN_MS, intended)
  const scaled = 1000 + Math.round(Math.max(0, intended - PRODUCTION_MIN_MS) * 0.04)
  return Math.min(2200, Math.max(1000, scaled))
}

export function localIso(d = new Date()): string {
  const p = (n: number, w = 2) => String(Math.trunc(Math.abs(n))).padStart(w, '0')
  const off = -d.getTimezoneOffset()
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}` +
    `${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`
  )
}
