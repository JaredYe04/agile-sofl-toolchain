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

  if (selection.kind === 'module') {

    return ['revealInCode', 'addProcess', 'addFunction', 'addDeclaration', 'addModule', 'renameModule', 'removeModule']

  }

  if (selection.kind === 'process') {

    return ['revealInCode', 'editProcess', 'addScenario', 'renameProcess', 'removeProcess']

  }

  if (selection.kind === 'function') {

    return ['revealInCode', 'addScenario', 'renameFunction', 'removeFunction']

  }

  return ['revealInCode']

}

