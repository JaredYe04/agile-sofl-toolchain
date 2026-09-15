export type GuiSeverity = 'error' | 'warning' | 'info'

export interface GuiDiagnostic {
  code: string
  message: string
  severity: GuiSeverity
  path?: string
  line?: number
  column?: number
}

export type GuiWidgetKind =
  | 'label'
  | 'text-input'
  | 'button'
  | 'checkbox'
  | 'select'
  | 'list'
  | 'table'
  | 'section'
  | 'navigation'

export interface GuiBinds {
  param?: string
  variable?: string
  display?: string
  out?: string
}

export interface GuiBindRef {
  kind: 'param' | 'var' | 'out' | 'display'
  name: string
}

export interface GuiBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface GuiWidgetEvent {
  on: string
  action: string
  targetView?: string
}

export interface GuiWidget {
  id: string
  kind: GuiWidgetKind
  label?: string
  description?: string
  action?: string
  binds?: GuiBinds
  options?: string[]
  bounds?: GuiBounds
  events?: GuiWidgetEvent[]
  process?: string
  nav?: string
}

export interface GuiViewSize {
  width: number
  height: number
}

export interface GuiScreen {
  id: string
  name: string
  title?: string
  description?: string
  triggersProcess?: string
  widgets?: GuiWidget[]
  size?: GuiViewSize
  html?: string
}

export interface GuiFlow {
  from: string
  to: string
  on?: string
  label?: string
}

export interface GuiApp {
  name: string
  description?: string
}

export interface GuiSection {
  app: GuiApp
  screens: GuiScreen[]
  flows?: GuiFlow[]
}

export interface GuiMeta {
  id: string
  title: string
  author?: string
  revision?: string
  informalTarget?: string
}

export interface GuiDocument {
  guispecVersion: string
  meta: GuiMeta
  gui: GuiSection
  html: string
}

export interface GuiScreenDto extends GuiScreen {
  widgetCount: number
}

export interface GuiDocumentModel {
  meta: GuiMeta
  app: GuiApp
  screens: GuiScreenDto[]
  flows: GuiFlow[]
  diagnostics: GuiDiagnostic[]
  sourceKind: 'guispec' | 'aspec-embedded' | 'gui-html'
  html: string
}

export interface InformalProcessRef {
  id: string
  name: string
  moduleId: string
}

export interface InformalVariableRef {
  id: string
  name: string
  moduleId: string
}

export interface HybridProcessRef {
  moduleName: string
  processName: string
  inputs: string[]
  outputs: string[]
  vars: string[]
}
