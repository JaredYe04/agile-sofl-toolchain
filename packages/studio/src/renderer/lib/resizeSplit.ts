export function clampSplitRatio(ratio: number, minFirst: number, minSecond: number): number {
  const lo = Math.min(minFirst, 1 - minSecond)
  const hi = Math.max(1 - minSecond, minFirst)
  if (!Number.isFinite(ratio)) return lo
  return Math.min(hi, Math.max(lo, ratio))
}

/** Keep the bar glued to the pointer: new ratio = start + delta / (container − gutter). */
export function splitRatioFromDelta(args: {
  startRatio: number
  startPos: number
  pos: number
  available: number
  minFirst: number
  minSecond: number
}): number {
  if (args.available <= 0) {
    return clampSplitRatio(args.startRatio, args.minFirst, args.minSecond)
  }
  return clampSplitRatio(
    args.startRatio + (args.pos - args.startPos) / args.available,
    args.minFirst,
    args.minSecond
  )
}

export function splitPaneFlex(ratio: number): string {
  const weight = Math.max(0, ratio)
  return `${weight} 1 0%`
}
