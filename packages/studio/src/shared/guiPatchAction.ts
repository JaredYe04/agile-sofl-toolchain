import type { PatchGuiAction } from '@agile-sofl/gui'

type GuiWidgetKind = Extract<PatchGuiAction, { action: 'add-widget' }>['widget']['kind']

/**
 * Map an agent GUI operation onto the action `studio:patch-gui` applies.
 * Shared by the Agent panel (`applyGuiDocumentPatch`) and the subject runner.
 */
export function toGuiPatchAction(op: Record<string, unknown>): PatchGuiAction | null {
  const kind = String(op.op || op.action || '')
  if (kind === 'replace-html' || kind === 'replace-document') {
    return { action: 'replace-html', html: String(op.html ?? op.text ?? '') }
  }
  if (kind === 'add' || kind === 'add-screen') {
    return {
      action: 'add-screen',
      screen: {
        id: String(op.id || op.name || `scr-${Date.now()}`),
        name: String(op.name || op.id || 'Screen'),
        title: typeof op.title === 'string' ? op.title : undefined,
        widgets: [],
        html: typeof op.html === 'string' ? op.html : typeof op.text === 'string' ? op.text : undefined
      }
    }
  }
  if (kind === 'remove' || kind === 'remove-screen') {
    return { action: 'remove-screen', screenId: String(op.id || op.screenId || '') }
  }
  if (kind === 'add-widget') {
    return {
      action: 'add-widget',
      screenId: String(op.screenId || op.parentId || ''),
      widget: {
        id: String(op.id || `w-${Date.now()}`),
        kind: ((op.kind as GuiWidgetKind) || 'button'),
        label: typeof op.label === 'string' ? op.label : String(op.name || 'Widget'),
        process: typeof op.process === 'string' ? op.process : undefined,
        nav: typeof op.nav === 'string' ? op.nav : undefined
      }
    }
  }
  if (kind === 'replace-screen-html') {
    return {
      action: 'replace-screen-html',
      screenId: String(op.screenId || op.id || ''),
      html: String(op.html || op.text || '')
    }
  }
  if (kind === 'insert-html') {
    return {
      action: 'insert-html',
      parentPath: String(op.parentPath || op.screenId || '0'),
      html: String(op.html || op.text || '')
    }
  }
  if (kind === 'patch-node') {
    return {
      action: 'patch-node',
      path: String(op.path || op.id || ''),
      attrs: (op.attrs as Record<string, string | null> | undefined) ?? undefined,
      text: typeof op.text === 'string' ? op.text : undefined
    }
  }
  if (kind === 'remove-node') {
    return { action: 'remove-node', path: String(op.path || op.id || '') }
  }
  return null
}
