import { describe, expect, it } from 'vitest'
import { clampSplitRatio, splitPaneFlex, splitRatioFromDelta } from '../src/renderer/lib/resizeSplit'

describe('splitRatioFromDelta', () => {
  it('does not jump when the pointer has not moved', () => {
    expect(
      splitRatioFromDelta({
        startRatio: 0.38,
        startPos: 420,
        pos: 420,
        available: 1000,
        minFirst: 0.15,
        minSecond: 0.15
      })
    ).toBe(0.38)
  })

  it('moves the same number of pixels as the pointer', () => {
    expect(
      splitRatioFromDelta({
        startRatio: 0.38,
        startPos: 400,
        pos: 450,
        available: 1000,
        minFirst: 0.15,
        minSecond: 0.15
      })
    ).toBeCloseTo(0.43, 8)
  })

  it('clamps to the min panes', () => {
    expect(
      splitRatioFromDelta({
        startRatio: 0.2,
        startPos: 0,
        pos: -400,
        available: 1000,
        minFirst: 0.15,
        minSecond: 0.15
      })
    ).toBe(0.15)
    expect(
      splitRatioFromDelta({
        startRatio: 0.8,
        startPos: 0,
        pos: 400,
        available: 1000,
        minFirst: 0.15,
        minSecond: 0.15
      })
    ).toBe(0.85)
  })
})

describe('clampSplitRatio / splitPaneFlex', () => {
  it('keeps invalid numbers inside the band', () => {
    expect(clampSplitRatio(Number.NaN, 0.15, 0.15)).toBe(0.15)
    expect(splitPaneFlex(0.38)).toBe('0.38 1 0%')
  })
})
