import { describe, it, expect } from 'vitest'
import {
  computeUnpaired,
  pairCompleteness,
  type ProjectPair
} from '../src/renderer/composables/useProjectScan'
import type { ProjectScanPayload } from '../src/preload/index'

const sampleScan: ProjectScanPayload = {
  root: '/proj',
  aspecFiles: ['/proj/a.aspec', '/proj/orphan.aspec'],
  asflFiles: ['/proj/a.asfl', '/proj/orphan.asfl'],
  guispecFiles: ['/proj/a-gui.guispec', '/proj/orphan.guispec'],
  pairs: [
    {
      aspecPath: '/proj/a.aspec',
      asflPath: '/proj/a.asfl',
      guispecPath: '/proj/a-gui.guispec'
    }
  ]
}

describe('useProjectScan helpers', () => {
  it('computes pair completeness', () => {
    const full: ProjectPair = {
      aspecPath: '/x.aspec',
      asflPath: '/x.asfl',
      guispecPath: '/x.guispec'
    }
    const partial: ProjectPair = { aspecPath: '/x.aspec', asflPath: '/x.asfl' }
    const informal: ProjectPair = { aspecPath: '/x.aspec' }

    expect(pairCompleteness(full)).toBe('full')
    expect(pairCompleteness(partial)).toBe('partial')
    expect(pairCompleteness(informal)).toBe('informal-only')
  })

  it('groups unpaired files by extension', () => {
    const unpaired = computeUnpaired(sampleScan)
    expect(unpaired.aspec).toEqual(['/proj/orphan.aspec'])
    expect(unpaired.asfl).toEqual(['/proj/orphan.asfl'])
    expect(unpaired.guispec).toEqual(['/proj/orphan.guispec'])
  })
})
