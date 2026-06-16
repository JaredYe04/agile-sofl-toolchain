import { ref } from 'vue'
import type { ProjectPair } from './useProjectScan'

export type ProjectMenuContext =
  | { kind: 'panel' }
  | { kind: 'pair'; pair: ProjectPair; path?: string }
  | { kind: 'file'; path: string }

export type ProjectMenuAction =
  | 'openAspec'
  | 'openAsfl'
  | 'openGuispec'
  | 'openAll'
  | 'reveal'
  | 'copyPath'
  | 'openFolder'
  | 'refresh'
  | 'closeProject'
  | 'collapse'

export interface ProjectMenuItem {
  id: ProjectMenuAction
  labelKey: string
  disabled?: boolean
  separator?: boolean
}

const open = ref(false)
const x = ref(0)
const y = ref(0)
const context = ref<ProjectMenuContext>({ kind: 'panel' })

export function useProjectContextMenu() {
  function show(clientX: number, clientY: number, ctx: ProjectMenuContext): void {
    context.value = ctx
    x.value = clientX
    y.value = clientY
    open.value = true
  }

  function hide(): void {
    open.value = false
  }

  function buildItems(ctx: ProjectMenuContext): ProjectMenuItem[] {
    if (ctx.kind === 'panel') {
      return [
        { id: 'openFolder', labelKey: 'sidebar.context.openFolder' },
        { id: 'refresh', labelKey: 'sidebar.context.refresh' },
        { id: 'closeProject', labelKey: 'sidebar.context.closeProject' },
        { id: 'collapse', labelKey: 'sidebar.context.collapse', separator: true }
      ]
    }

    if (ctx.kind === 'pair') {
      const { pair } = ctx
      const targetPath = ctx.path
      return [
        { id: 'openAspec', labelKey: 'sidebar.context.openAspec', disabled: !pair.aspecPath },
        { id: 'openAsfl', labelKey: 'sidebar.context.openAsfl', disabled: !pair.asflPath },
        { id: 'openGuispec', labelKey: 'sidebar.context.openGuispec', disabled: !pair.guispecPath },
        { id: 'openAll', labelKey: 'sidebar.context.openAll', separator: true },
        {
          id: 'reveal',
          labelKey: 'sidebar.context.reveal',
          disabled: !targetPath && !pair.aspecPath
        },
        {
          id: 'copyPath',
          labelKey: 'sidebar.context.copyPath',
          disabled: !targetPath && !pair.aspecPath
        }
      ]
    }

    return [
      { id: 'reveal', labelKey: 'sidebar.context.reveal' },
      { id: 'copyPath', labelKey: 'sidebar.context.copyPath' }
    ]
  }

  return { open, x, y, context, show, hide, buildItems }
}
