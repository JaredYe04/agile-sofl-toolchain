<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import type { IndexedProject, ProjectModuleInfo, ProjectModuleMember } from '../../../preload/index'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { useGitStatus } from '../../composables/useGitStatus'
import { initWorkspaceTreeMenuProviders } from '../../workspaceTree/init'
import { buildWorkspaceTreeMenu } from '../../workspaceTree/registry'
import { executeWorkspaceTreeAction, promptNewProject } from '../../workspaceTree/actions'
import type { WorkspaceTreeContext } from '../../workspaceTree/types'
import WorkspaceTreeContextMenu from './WorkspaceTreeContextMenu.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import StudioIcon from '../ui/StudioIcon.vue'
import { contextMenuPoint } from '../../lib/contextMenuPoint'

initWorkspaceTreeMenuProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const git = useGitStatus()

const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuCtx = ref<WorkspaceTreeContext>({ kind: 'blank' })
const expandedModuleKeys = ref<string[]>([])
const menuItems = computed(() => {
  void git.gitState.byRoot
  return buildWorkspaceTreeMenu(menuCtx.value)
})

function sortedModules(projectId: string): ProjectModuleInfo[] {
  return [...workspace.modulesFor(projectId)]
    .filter((m) => m.name.trim() && m.displayName.trim())
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      return a.displayName.localeCompare(b.displayName)
    })
}

function moduleKey(projectId: string, mod: ProjectModuleInfo): string {
  return `${projectId}:${mod.filePath}:${mod.name}`
}

function isModuleExpanded(projectId: string, mod: ProjectModuleInfo): boolean {
  return expandedModuleKeys.value.includes(moduleKey(projectId, mod))
}

function toggleModuleExpanded(projectId: string, mod: ProjectModuleInfo, e: Event): void {
  e.preventDefault()
  e.stopPropagation()
  const key = moduleKey(projectId, mod)
  if (expandedModuleKeys.value.includes(key)) {
    expandedModuleKeys.value = expandedModuleKeys.value.filter((k) => k !== key)
  } else {
    expandedModuleKeys.value = [...expandedModuleKeys.value, key]
  }
}

function memberLabel(kind: ProjectModuleMember['kind']): string {
  if (kind === 'type') return t('visual.section.type')
  if (kind === 'var') return t('visual.section.var')
  if (kind === 'const') return t('visual.section.const')
  if (kind === 'inv') return t('visual.section.inv')
  if (kind === 'process') return t('visual.section.processes')
  if (kind === 'function') return t('visual.section.functions')
  return t('visual.section.gui')
}

function namedMembers(mod: ProjectModuleInfo): ProjectModuleMember[] {
  return (mod.members ?? []).filter((m) => m.name.trim())
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
  const pt = contextMenuPoint(e)
  menuX.value = pt.x
  menuY.value = pt.y
  menuOpen.value = true
}

async function onPick(action: Parameters<typeof executeWorkspaceTreeAction>[0]): Promise<void> {
  menuOpen.value = false
  await executeWorkspaceTreeAction(action, menuCtx.value, visual, t)
}

async function onSelectModule(project: IndexedProject, name: string): Promise<void> {
  if (project.id !== workspace.activeProjectId) {
    const ok = await workspace.requestActivateProject(project)
    if (!ok) return
  }
  workspace.selectModule(name)
}

async function onSelectMember(
  project: IndexedProject,
  mod: ProjectModuleInfo,
  member: ProjectModuleMember
): Promise<void> {
  if (project.id !== workspace.activeProjectId) {
    const ok = await workspace.requestActivateProject(project)
    if (!ok) return
  }
  if (member.kind === 'process') {
    workspace.selectModule(mod.name, { kind: 'process', moduleName: mod.name, processName: member.name })
  } else if (member.kind === 'function') {
    workspace.selectModule(mod.name, { kind: 'function', moduleName: mod.name, functionName: member.name })
  } else {
    workspace.selectModule(mod.name, { kind: 'module', moduleName: mod.name })
  }
  workspace.setFocusedPanel('hybrid')
}

function onProjectClick(project: IndexedProject): void {
  if (project.id !== workspace.activeProjectId) return
  workspace.toggleProjectExpanded(project.id)
}

async function onOpenProject(project: IndexedProject): Promise<void> {
  await workspace.requestActivateProject(project)
}

function isDirty(projectId: string, name: string): boolean {
  return projectId === workspace.activeProjectId && workspace.isModuleDirty(name)
}

function moduleContext(project: IndexedProject, mod: ProjectModuleInfo): WorkspaceTreeContext {
  if (mod.isSystem) return { kind: 'systemModule', project, module: mod }
  return { kind: 'module', project, module: mod }
}

function gitClassForProject(project: IndexedProject): string {
  return git.classForProject(project.rootPath)
}

function gitClassForModule(project: IndexedProject, mod: ProjectModuleInfo): string {
  return git.classForModule(project.rootPath, mod.filePath)
}

watch(
  () => workspace.projects.map((p) => p.rootPath).join('\0'),
  () => {
    for (const project of workspace.projects) {
      void git.refreshGitFor(project.rootPath)
    }
  },
  { immediate: true }
)
</script>

<template>
  <WorkspacePanel panel="tree" class="flex flex-col overflow-hidden bg-surface-raised">
    <div class="flex shrink-0 items-center gap-0.5 border-b border-border-subtle px-2 py-1.5">
      <div
        class="flex min-w-0 flex-1 items-center px-1 text-content-primary"
        :title="t('workspace.fileHierarchy')"
      >
        <StudioIcon icon="hugeicons:hierarchy-square-01" :size="18" />
      </div>
      <button
        type="button"
        class="rounded-md p-1.5 text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        :title="t('workspace.newProject')"
        :aria-label="t('workspace.newProject')"
        @click="promptNewProject(t)"
      >
        <StudioIcon icon="lucide:folder-plus" :size="16" />
      </button>
      <button
        type="button"
        class="rounded-md p-1.5 text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        :title="t('workspace.openProject')"
        :aria-label="t('workspace.openProject')"
        @click="workspace.openProjectFolder()"
      >
        <StudioIcon icon="lucide:folder-open" :size="16" />
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
          :title="
            project.id === workspace.activeProjectId
              ? project.name
              : t('workspace.doubleClickToOpen')
          "
          @click="onProjectClick(project)"
          @dblclick="void onOpenProject(project)"
          @contextmenu="showMenu($event, { kind: 'project', project })"
        >
          <span class="w-3 shrink-0 text-content-muted">
            <template v-if="project.id === workspace.activeProjectId">
              {{ workspace.expandedProjectIds.includes(project.id) ? '▾' : '▸' }}
            </template>
          </span>
          <span
            class="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary"
            :class="gitClassForProject(project)"
          >{{ project.name }}</span>
        </div>
        <div
          v-if="
            project.id === workspace.activeProjectId &&
            workspace.expandedProjectIds.includes(project.id)
          "
          class="mt-0.5"
        >
          <div
            v-for="mod in sortedModules(project.id)"
            :key="moduleKey(project.id, mod)"
          >
            <button
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
              :style="{ paddingLeft: `${8 + depthOf(project.id, mod.name) * 12}px` }"
              @click="void onSelectModule(project, mod.name)"
              @contextmenu="showMenu($event, moduleContext(project, mod))"
            >
              <span
                class="w-3 shrink-0 text-content-muted"
                @click="namedMembers(mod).length ? toggleModuleExpanded(project.id, mod, $event) : undefined"
              >
                <template v-if="namedMembers(mod).length">
                  {{ isModuleExpanded(project.id, mod) ? '▾' : '▸' }}
                </template>
              </span>
              <span class="min-w-0 flex-1 truncate" :class="gitClassForModule(project, mod)">{{
                mod.displayName
              }}</span>
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
            <div v-if="isModuleExpanded(project.id, mod)" class="mb-0.5">
              <button
                v-for="(member, idx) in namedMembers(mod)"
                :key="`${moduleKey(project.id, mod)}:${member.kind}:${member.name}:${idx}`"
                type="button"
                class="flex w-full items-center gap-1 border-l-2 py-0.5 pr-2 text-left text-[11px] text-content-muted hover:bg-surface-overlay hover:text-content-secondary"
                :class="
                  project.id === workspace.activeProjectId &&
                  workspace.selectedModuleName === mod.name &&
                  ((member.kind === 'process' &&
                    workspace.selection?.kind === 'process' &&
                    workspace.selection.processName === member.name) ||
                    (member.kind === 'function' &&
                      workspace.selection?.kind === 'function' &&
                      workspace.selection.functionName === member.name))
                    ? 'border-accent bg-accent/10 text-content-primary'
                    : 'border-transparent'
                "
                :style="{ paddingLeft: `${26 + depthOf(project.id, mod.name) * 12}px` }"
                :title="`${memberLabel(member.kind)} ${member.name}`"
                @click="void onSelectMember(project, mod, member)"
              >
                <span class="shrink-0 rounded bg-surface-overlay px-1 text-[9px] uppercase tracking-wide">{{
                  member.kind === 'gui-screen' ? 'gui' : member.kind === 'process' ? 'proc' : member.kind
                }}</span>
                <span class="min-w-0 flex-1 truncate">{{ member.name }}</span>
              </button>
            </div>
          </div>
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
