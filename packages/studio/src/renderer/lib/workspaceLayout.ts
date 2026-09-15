import type { DockNode, DockPanelId } from '../../shared/dockLayout'
import {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_SLOT_PANELS,
  presetById,
  WORKSPACE_LAYOUT_PRESETS,
  type LayoutTopology,
  type WorkspaceLayoutPresetId,
  type WorkspaceSlotPanels
} from '../../shared/workspaceLayout'

export type {
  WorkspaceLayoutPresetId,
  WorkspaceSlotPanels,
  WorkspaceSlotIndex
} from '../../shared/workspaceLayout'

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_SLOT_PANELS,
  WORKSPACE_LAYOUT_PRESETS,
  presetById
} from '../../shared/workspaceLayout'

export const WORKSPACE_PANEL_IDS: DockPanelId[] = ['informal', 'agent', 'hybrid']

export type SplitRatioKey = string

export function splitPathKey(path: readonly number[]): SplitRatioKey {
  return path.length ? path.join('-') : ''
}

function ratioForPath(
  topology: LayoutTopology,
  path: readonly number[],
  overrides: Readonly<Record<SplitRatioKey, number>>
): number {
  if (topology.kind === 'slot') return 0.5
  const key = splitPathKey(path)
  const raw = overrides[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(0.85, Math.max(0.15, raw))
  }
  return topology.ratio
}

function topologyToNode(
  topology: LayoutTopology,
  slots: WorkspaceSlotPanels,
  path: number[],
  overrides: Readonly<Record<SplitRatioKey, number>>
): DockNode {
  if (topology.kind === 'slot') {
    return { kind: 'panel', panel: slots[topology.index] }
  }
  const ratio = ratioForPath(topology, path, overrides)
  return {
    kind: 'split',
    direction: topology.direction,
    ratio,
    first: topologyToNode(topology.first, slots, [...path, 0], overrides),
    second: topologyToNode(topology.second, slots, [...path, 1], overrides)
  }
}

export function buildDockLayout(
  presetId: WorkspaceLayoutPresetId,
  slotPanels: WorkspaceSlotPanels,
  splitRatios: Readonly<Record<SplitRatioKey, number>> = {}
): DockNode {
  const preset = presetById(presetId)
  return topologyToNode(preset.topology, slotPanels, [], splitRatios)
}

export function defaultDockLayout(): DockNode {
  return buildDockLayout(DEFAULT_LAYOUT_PRESET_ID, DEFAULT_SLOT_PANELS)
}

export function updateSplitRatioAtPath(root: DockNode, path: readonly number[], ratio: number): DockNode {
  if (path.length === 0) {
    if (root.kind === 'split') return { ...root, ratio }
    return root
  }
  if (root.kind !== 'split') return root
  const [head, ...rest] = path
  if (head === 0) return { ...root, first: updateSplitRatioAtPath(root.first, rest, ratio) }
  return { ...root, second: updateSplitRatioAtPath(root.second, rest, ratio) }
}

export function isValidSlotPanels(raw: unknown): raw is WorkspaceSlotPanels {
  if (!Array.isArray(raw) || raw.length !== 3) return false
  const set = new Set(raw)
  if (set.size !== 3) return false
  return WORKSPACE_PANEL_IDS.every((id) => set.has(id))
}

export function parseLayoutPresetId(raw: unknown): WorkspaceLayoutPresetId {
  if (typeof raw === 'string' && WORKSPACE_LAYOUT_PRESETS.some((p) => p.id === raw)) {
    return raw as WorkspaceLayoutPresetId
  }
  return DEFAULT_LAYOUT_PRESET_ID
}

export function parseSlotPanels(raw: unknown): WorkspaceSlotPanels {
  if (isValidSlotPanels(raw)) return [...raw]
  return [...DEFAULT_SLOT_PANELS]
}

export function parseSplitRatios(raw: unknown): Record<SplitRatioKey, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<SplitRatioKey, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.min(0.85, Math.max(0.15, value))
    }
  }
  return out
}

/** Assign `panel` to slot `slotIndex`; swap if that panel is already on another slot. */
export function assignPanelToSlot(
  slots: WorkspaceSlotPanels,
  slotIndex: 0 | 1 | 2,
  panel: DockPanelId
): WorkspaceSlotPanels {
  const next: WorkspaceSlotPanels = [...slots]
  const other = next.findIndex((p, i) => i !== slotIndex && p === panel)
  const prev = next[slotIndex]
  next[slotIndex] = panel
  if (other >= 0) next[other as 0 | 1 | 2] = prev
  return next
}

export function reorderSlotPanels(
  slots: WorkspaceSlotPanels,
  fromIndex: number,
  toIndex: number
): WorkspaceSlotPanels {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex > 2 || toIndex < 0 || toIndex > 2) {
    return slots
  }
  const next = [...slots] as WorkspaceSlotPanels
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
