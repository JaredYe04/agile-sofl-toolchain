<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from '../../ui/Checkbox.vue'

export type AgentSessionPermissions = {
  informal: { read: boolean; write: boolean }
  hybrid: { read: boolean; write: boolean }
}

export type AgentSessionCreatePayload = {
  title?: string
  permissions: AgentSessionPermissions
}

const FULL_PERMISSIONS: AgentSessionPermissions = {
  informal: { read: true, write: true },
  hybrid: { read: true, write: true }
}

const CUSTOM_PRESET: AgentSessionPermissions = {
  informal: { read: true, write: true },
  hybrid: { read: true, write: false }
}

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  create: [payload: AgentSessionCreatePayload]
}>()

const { t } = useI18n()
const sessionTitle = ref('')
const titleEl = ref<HTMLInputElement | null>(null)
const permissions = ref<AgentSessionPermissions>(clonePermissions(FULL_PERMISSIONS))

const selectAll = computed(
  () =>
    permissions.value.informal.read &&
    permissions.value.informal.write &&
    permissions.value.hybrid.read &&
    permissions.value.hybrid.write
)

function clonePermissions(value: AgentSessionPermissions): AgentSessionPermissions {
  return {
    informal: { ...value.informal },
    hybrid: { ...value.hybrid }
  }
}

function reset(): void {
  sessionTitle.value = ''
  permissions.value = clonePermissions(FULL_PERMISSIONS)
}

function setFlag(scope: 'informal' | 'hybrid', key: 'read' | 'write', value: boolean): void {
  const next = clonePermissions(permissions.value)
  next[scope][key] = value
  if (key === 'write' && value) next[scope].read = true
  if (key === 'read' && !value) next[scope].write = false
  permissions.value = next
}

function toggleSelectAll(on: boolean): void {
  permissions.value = clonePermissions(on ? FULL_PERMISSIONS : CUSTOM_PRESET)
}

function create(): void {
  const title = sessionTitle.value.trim()
  emit('create', {
    ...(title ? { title } : {}),
    permissions: clonePermissions(permissions.value)
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  async (on) => {
    if (!on) return
    reset()
    await nextTick()
    titleEl.value?.focus()
  },
  { immediate: true }
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
  <div
    v-if="open"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
    role="dialog"
    aria-modal="true"
    :aria-label="t('agent.sessionDialogTitle')"
    @click.self="emit('close')"
  >
    <div
      class="flex w-[min(440px,100%)] max-h-[80vh] flex-col rounded-xl border border-border-subtle bg-surface-raised shadow-lg"
      @click.stop
    >
      <header class="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <h3 class="mr-auto text-sm font-semibold text-content-primary">{{ t('agent.sessionDialogTitle') }}</h3>
        <button type="button" class="text-content-muted" @click="emit('close')">×</button>
      </header>

      <div class="min-h-0 flex-1 space-y-3 overflow-auto p-4 studio-scroll">
        <input
          ref="titleEl"
          v-model="sessionTitle"
          type="text"
          class="visual-field w-full px-3 py-2 text-[13px]"
          :placeholder="t('agent.sessionTitlePlaceholder')"
        />

        <div class="space-y-2">
          <p class="text-[12px] font-medium text-content-primary">{{ t('agent.sessionPermissions') }}</p>
          <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
            <Checkbox
              :model-value="selectAll"
              :label="t('agent.selectAll')"
              @update:model-value="toggleSelectAll"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
              <Checkbox
                :model-value="permissions.informal.read"
                :label="t('agent.permInformalRead')"
                @update:model-value="setFlag('informal', 'read', $event)"
              />
            </div>
            <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
              <Checkbox
                :model-value="permissions.informal.write"
                :label="t('agent.permInformalWrite')"
                @update:model-value="setFlag('informal', 'write', $event)"
              />
            </div>
            <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
              <Checkbox
                :model-value="permissions.hybrid.read"
                :label="t('agent.permHybridRead')"
                @update:model-value="setFlag('hybrid', 'read', $event)"
              />
            </div>
            <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
              <Checkbox
                :model-value="permissions.hybrid.write"
                :label="t('agent.permHybridWrite')"
                @update:model-value="setFlag('hybrid', 'write', $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <footer class="flex flex-wrap justify-end gap-2 border-t border-border-subtle px-4 py-3">
        <button
          type="button"
          class="rounded-md border border-border-subtle px-3 py-1.5 text-[12px] text-content-secondary hover:bg-surface-overlay"
          @click="emit('close')"
        >
          {{ t('workspace.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg hover:opacity-90"
          @click="create"
        >
          {{ t('agent.createSession') }}
        </button>
      </footer>
    </div>
  </div>
  </Teleport>
</template>
