<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconActionButton from '../../../ui/IconActionButton.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    size?: 'md' | 'lg'
    confirmDisabled?: boolean
  }>(),
  { size: 'md', confirmDisabled: false }
)

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[min(720px,88vh)] w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-xl"
        :class="size === 'lg' ? 'max-w-4xl' : 'max-w-lg'"
        @click.stop
      >
        <header class="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
          <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary">{{ title }}</h2>
          <IconActionButton icon="lucide:x" :label="t('window.close')" @click="emit('close')" />
        </header>
        <div class="studio-scroll min-h-0 flex-1 overflow-auto p-4">
          <slot />
        </div>
        <footer class="flex shrink-0 items-center justify-end gap-1 border-t border-border-subtle px-4 py-2">
          <IconActionButton icon="lucide:x" :label="t('dialog.cancel')" @click="emit('close')" />
          <IconActionButton
            icon="lucide:check"
            :label="t('dialog.ok')"
            variant="accent"
            :disabled="confirmDisabled"
            @click="emit('confirm')"
          />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
