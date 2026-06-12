import type { TreeSelection } from './useVisualModel'
import type { DeclarationKind } from '../../preload/index'

export type VisualActionType =
  | 'revealInCode'
  | 'addProcess'
  | 'addFunction'
  | 'addDeclaration'
  | 'addScenario'
  | 'removeProcess'
  | 'removeFunction'
  | 'editProcess'
  | 'renameProcess'
  | 'renameFunction'
  | 'addModule'
  | 'removeModule'
  | 'renameModule'

export type VisualAction = {
  type: VisualActionType
  selection: TreeSelection
  declarationKind?: DeclarationKind
}

export function actionsForSelection(
  selection: TreeSelection,
  opts: { parseFailed: boolean; hasDiagnostics: boolean }
): VisualActionType[] {
  if (!selection || opts.parseFailed) return ['revealInCode']
  const writeBlocked = opts.hasDiagnostics
  if (selection.kind === 'module') {
    const base: VisualActionType[] = ['revealInCode']
    if (!writeBlocked) {
      base.push('addProcess', 'addFunction', 'addDeclaration', 'addModule', 'renameModule', 'removeModule')
    }
    return base
  }
  if (selection.kind === 'process') {
    const base: VisualActionType[] = ['revealInCode', 'editProcess']
    if (!writeBlocked) base.push('addScenario', 'renameProcess', 'removeProcess')
    return base
  }
  if (selection.kind === 'function') {
    const base: VisualActionType[] = ['revealInCode']
    if (!writeBlocked) base.push('addScenario', 'renameFunction', 'removeFunction')
    return base
  }
  return ['revealInCode']
}
