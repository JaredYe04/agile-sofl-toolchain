export const SPEC_MAP_KINDS = [
  'architecture',
  'workflow',
  'sequence',
  'dataflow',
  'lifecycle'
] as const

export type SpecMapKind = (typeof SPEC_MAP_KINDS)[number]

export const PRIMARY_NODE_LIMIT = 12

export type SpecMapSemanticKind =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'process'
  | 'store'
  | 'external'
  | 'security'
  | 'start'
  | 'active'
  | 'waiting'
  | 'decision'
  | 'success'
  | 'failure'

export type SpecMapEdgeKind =
  | 'parent'
  | 'decom'
  | 'flow'
  | 'call'
  | 'read'
  | 'write'
  | 'nav'
  | 'exception'
  | 'transition'
  | 'message'

export type SpecMapEmptyReason =
  | 'no-hybrid-modules'
  | 'no-process-flow'
  | 'no-gui-flows'
  | 'no-data-flow'
  | 'no-lifecycle-states'
  | 'no-specification'

export type SpecMapRef =
  | { spec: 'informal'; id: string }
  | {
      spec: 'hybrid'
      moduleName: string
      processName?: string
      functionName?: string
      varName?: string
      typeName?: string
    }
  | { spec: 'gui'; screenId: string }

export interface SpecMapNode {
  id: string
  label: string
  kind: SpecMapSemanticKind
  laneId?: string
  specRef?: SpecMapRef
  column?: number
}

export interface SpecMapEdge {
  id: string
  from: string
  to: string
  label?: string
  kind?: SpecMapEdgeKind
}

export interface SpecMapLane {
  id: string
  label: string
}

export interface SpecMap {
  type: SpecMapKind
  title: string
  nodes: SpecMapNode[]
  edges: SpecMapEdge[]
  lanes?: SpecMapLane[]
  emptyReason?: SpecMapEmptyReason
  truncatedCount?: number
}

export type HybridMapInput = {
  modules: HybridModuleInput[]
  fsfModels?: HybridFsfInput[]
}

export interface HybridProcessInput {
  name: string
  decom?: string
  isInit?: boolean
  inputs?: Array<{ names: string; type: string }>
  outputs?: Array<{ names: string; type: string }>
  ext?: Array<{ access: 'rd' | 'wr'; name: string }>
}

export interface HybridModuleInput {
  name: string
  isSystem: boolean
  parentName?: string
  processes: HybridProcessInput[]
  functions: Array<{ name: string }>
  types?: Array<{ name: string }>
  vars?: Array<{ name: string }>
  gui?: { screens: Array<{ name: string; triggersProcess?: string }> }
}

export interface HybridFsfInput {
  processName: string
  moduleName?: string
  scenarios?: Array<{ id: string; name?: string; kind?: 'normal' | 'exceptional' }>
  exceptionalScenarios?: Array<{ id: string; name?: string; kind?: 'normal' | 'exceptional' }>
}

export interface InformalMapNode {
  id: string
  type: string
  title: string
  children?: InformalMapNode[]
}

export interface InformalMapInput {
  sections: Array<{
    type: string
    title?: string
    children: InformalMapNode[]
  }>
}

export interface GuiMapWidget {
  id?: string
  nav?: string
  process?: string
  action?: string
  events?: Array<{ action?: string; targetView?: string }>
}

export interface GuiMapInput {
  screens: Array<{
    id: string
    name: string
    title?: string
    triggersProcess?: string
    widgets?: GuiMapWidget[]
  }>
  flows?: Array<{ from: string; to: string; on?: string; label?: string }>
}

export interface SpecMapSource {
  informal?: InformalMapInput | null
  hybrid?: HybridMapInput | null
  gui?: GuiMapInput | null
}

export function isSpecMapKind(value: string): value is SpecMapKind {
  return (SPEC_MAP_KINDS as readonly string[]).includes(value)
}

export function structureModeFromChrome(value: string, current: string): 'tree' | SpecMapKind {
  if (value === 'tree') return 'tree'
  if (value === 'map' || value === 'graph') {
    return isSpecMapKind(current) ? current : 'architecture'
  }
  if (isSpecMapKind(value)) return value
  return 'tree'
}
