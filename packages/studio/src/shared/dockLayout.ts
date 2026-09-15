export type DockPanelId = 'informal' | 'agent' | 'hybrid'

export type DockLeaf = { kind: 'panel'; panel: DockPanelId }
export type DockSplit = {
  kind: 'split'
  direction: 'horizontal' | 'vertical'
  ratio: number
  first: DockNode
  second: DockNode
}
export type DockNode = DockLeaf | DockSplit
