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
}

export interface GuiWidget {
  id: string
  kind: GuiWidgetKind
  label?: string
  description?: string
  action?: string
  binds?: GuiBinds
  options?: string[]
}

export interface GuiScreen {
  id: string
  name: string
  title?: string
  description?: string
  triggersProcess?: string
  widgets?: GuiWidget[]
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
  sourceKind: 'guispec' | 'aspec-embedded'
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
