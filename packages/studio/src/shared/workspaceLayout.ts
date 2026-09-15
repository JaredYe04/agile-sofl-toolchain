import type { DockPanelId } from './dockLayout'

export type WorkspaceSlotIndex = 0 | 1 | 2
export type WorkspaceSlotPanels = [DockPanelId, DockPanelId, DockPanelId]

export type WorkspaceLayoutPresetId =
  | 'leftTwoRightOne'
  | 'leftOneRightTwo'
  | 'rightTwoLeftOne'
  | 'rightOneLeftTwo'
  | 'threeColumn'
  | 'topTwoBottomOne'
  | 'topOneBottomTwo'
  | 'bottomTwoTopOne'
  | 'stackVertical'
  | 'stackHorizontal'

export type LayoutTopologySlot = { kind: 'slot'; index: WorkspaceSlotIndex }
export type LayoutTopologySplit = {
  kind: 'split'
  direction: 'horizontal' | 'vertical'
  ratio: number
  first: LayoutTopology
  second: LayoutTopology
}
export type LayoutTopology = LayoutTopologySlot | LayoutTopologySplit

export type WorkspaceLayoutPreset = {
  id: WorkspaceLayoutPresetId
  topology: LayoutTopology
}

export const DEFAULT_LAYOUT_PRESET_ID: WorkspaceLayoutPresetId = 'leftTwoRightOne'

export const DEFAULT_SLOT_PANELS: WorkspaceSlotPanels = ['informal', 'agent', 'hybrid']

export const WORKSPACE_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  {
    id: 'leftTwoRightOne',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.38,
      first: {
        kind: 'split',
        direction: 'vertical',
        ratio: 0.58,
        first: { kind: 'slot', index: 0 },
        second: { kind: 'slot', index: 1 }
      },
      second: { kind: 'slot', index: 2 }
    }
  },
  {
    id: 'leftOneRightTwo',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.38,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'vertical',
        ratio: 0.58,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  },
  {
    id: 'rightTwoLeftOne',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.38,
      first: { kind: 'slot', index: 2 },
      second: {
        kind: 'split',
        direction: 'vertical',
        ratio: 0.58,
        first: { kind: 'slot', index: 0 },
        second: { kind: 'slot', index: 1 }
      }
    }
  },
  {
    id: 'rightOneLeftTwo',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.38,
      first: {
        kind: 'split',
        direction: 'vertical',
        ratio: 0.58,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      },
      second: { kind: 'slot', index: 0 }
    }
  },
  {
    id: 'threeColumn',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.34,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  },
  {
    id: 'topTwoBottomOne',
    topology: {
      kind: 'split',
      direction: 'vertical',
      ratio: 0.58,
      first: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'slot', index: 0 },
        second: { kind: 'slot', index: 1 }
      },
      second: { kind: 'slot', index: 2 }
    }
  },
  {
    id: 'topOneBottomTwo',
    topology: {
      kind: 'split',
      direction: 'vertical',
      ratio: 0.42,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  },
  {
    id: 'bottomTwoTopOne',
    topology: {
      kind: 'split',
      direction: 'vertical',
      ratio: 0.42,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  },
  {
    id: 'stackVertical',
    topology: {
      kind: 'split',
      direction: 'vertical',
      ratio: 0.34,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'vertical',
        ratio: 0.5,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  },
  {
    id: 'stackHorizontal',
    topology: {
      kind: 'split',
      direction: 'horizontal',
      ratio: 0.34,
      first: { kind: 'slot', index: 0 },
      second: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'slot', index: 1 },
        second: { kind: 'slot', index: 2 }
      }
    }
  }
]

export function presetById(id: WorkspaceLayoutPresetId): WorkspaceLayoutPreset {
  return WORKSPACE_LAYOUT_PRESETS.find((p) => p.id === id) ?? WORKSPACE_LAYOUT_PRESETS[0]
}
