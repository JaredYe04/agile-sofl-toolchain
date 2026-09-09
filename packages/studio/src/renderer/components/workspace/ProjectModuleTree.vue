<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import type { IndexedProject, ProjectModuleInfo } from '../../../preload/index'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { initWorkspaceTreeMenuProviders } from '../../workspaceTree/init'
import { buildWorkspaceTreeMenu } from '../../workspaceTree/registry'
import { executeWorkspaceTreeAction, promptNewProject } from '../../workspaceTree/actions'
import type { WorkspaceTreeContext } from '../../workspaceTree/types'
import WorkspaceTreeContextMenu from './WorkspaceTreeContextMenu.vue'
import WorkspacePanel from './WorkspacePanel.vue'

initWorkspaceTreeMenuProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)

const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuCtx = ref<WorkspaceTreeContext>({ kind: 'blank' })
const menuItems = computed(() => buildWorkspaceTreeMenu(menuCtx.value))

function sortedModules(projectId: string): ProjectModuleInfo[] {
  return [...workspace.modulesFor(projectId)].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.displayName.localeCompare(b.displayName)
  })
}

function depthOf(projectId: string, name: string, seen = new Set<string>()): number {
  const mod = workspace.modulesFor(projectId).find((m) => m.name === name)
  if (!mod?.parentName || seen.has(name)) return 0
  seen.add(name)
  return 1 + depthOf(projectId, mod.parentName, seen)
}

function showMenu(e: MouseEvent, ctx: WorkspaceTreeContext): void {
  e.preventDefault()
  e.stopPropagation()
  menuCtx.value = ctx
  menuX.value = e.clientX
  menuY.value = e.clientY
  menuOpen.value = true
}

async function onPick(action: Parameters<typeof executeWorkspaceTreeAction>[0]): Promise<void> {
  menuOpen.value = false
  await executeWorkspaceTreeAction(action, menuCtx.value, visual, t)
}

async function onSelectModule(project: IndexedProject, name: string): Promise<void> {
  if (project.id !== workspace.activeProjectId) {
    await workspace.activateProject(project)
  }
  workspace.selectModule(name)
}

function isDirty(projectId: string, name: string): boolean {
  return projectId === workspace.activeProjectId && workspace.isModuleDirty(name)
}

function moduleContext(project: IndexedProject, mod: ProjectModuleInfo): WorkspaceTreeContext {
  if (mod.isSystem) return { kind: 'systemModule', project, module: mod }
  return { kind: 'module', project, module: mod }
}
</script>

<template>
  <WorkspacePanel panel="tree" class="flex flex-col overflow-hidden bg-surface-raised">
    <div class="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2 py-2">
      <p class="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-content-primary">
        {{ t('workspace.fileHierarchy') }}
      </p>
      <button
        type="button"
        class="rounded-md px-1.5 py-1 text-[11px] text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        :title="t('workspace.newProject')"
        @click="promptNewProject(t)"
      >
        {{ t('workspace.new') }}
      </button>
      <button
        type="button"
        class="rounded-md px-1.5 py-1 text-[11px] text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        :title="t('workspace.openProject')"
        @click="workspace.openProjectFolder()"
      >
        {{ t('workspace.open') }}
      </button>
    </div>
    <div
      class="min-h-0 flex-1 overflow-y-auto studio-scroll p-1"
      @contextmenu="showMenu($event, { kind: 'blank' })"
    >
      <p v-if="!workspace.projects.length" class="px-2 py-3 text-xs text-content-muted">
        {{ t('workspace.emptyProjects') }}
      </p>
      <div v-for="project in workspace.projects" :key="project.id" class="mb-1.5">
        <div
          class="flex w-full items-center gap-1 rounded-md border-l-2 px-2 py-1.5 text-left hover:bg-surface-overlay"
          :class="
            project.id === workspace.activeProjectId
              ? 'border-accent bg-surface-overlay'
              : 'border-transparent bg-surface-base/60'
          "
          @click="
            workspace.toggleProjectExpanded(project.id);
            void workspace.activateProject(project)
          "
          @contextmenu="showMenu($event, { kind: 'project', project })"
        >
          <span class="w-3 shrink-0 text-content-muted">
            {{ workspace.expandedProjectIds.includes(project.id) ? '▾' : '▸' }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">{{
            project.name
          }}</span>
        </div>
        <div v-if="workspace.expandedProjectIds.includes(project.id)" class="mt-0.5">
          <button
            v-for="mod in sortedModules(project.id)"
            :key="mod.name"
            type="button"
            class="flex w-full items-center border-l-2 py-1 pr-2 text-left text-xs hover:bg-surface-overlay"
            :class="[
              project.id === workspace.activeProjectId && workspace.selectedModuleName === mod.name
                ? 'border-accent bg-accent/10 text-content-primary'
                : 'border-transparent text-content-secondary',
              mod.isSystem ? 'font-medium text-content-primary' : '',
              mod.isGui &&
              !(project.id === workspace.activeProjectId && workspace.selectedModuleName === mod.name)
                ? 'border-accent/50'
                : ''
            ]"
            :style="{ paddingLeft: `${18 + depthOf(project.id, mod.name) * 12}px` }"
            @click="void onSelectModule(project, mod.name)"
            @contextmenu="showMenu($event, moduleContext(project, mod))"
          >
            <span class="min-w-0 flex-1 truncate">{{ mod.displayName }}</span>
            <span
              v-if="mod.isSystem"
              class="ml-1 rounded bg-surface-overlay px-1 text-[9px] uppercase tracking-wide text-content-muted"
            >SYS</span>
            <span
              v-if="mod.isGui"
              class="ml-1 rounded bg-accent/20 px-1 text-[9px] uppercase tracking-wide text-accent"
            >GUI</span>
            <span v-if="isDirty(project.id, mod.name)" class="ml-1 text-accent">●</span>
          </button>
        </div>
      </div>
    </div>
    <WorkspaceTreeContextMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      :items="menuItems"
      @pick="onPick"
      @close="menuOpen = false"
    />
  </WorkspacePanel>
</template>
