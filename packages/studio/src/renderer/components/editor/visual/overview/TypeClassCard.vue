<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualDeclarationItem } from '../../../../preload/index'
import { typeExpressionOf } from '../../../../lib/visualDecls'
import VisualEntityMenu from './VisualEntityMenu.vue'

const props = defineProps<{
  item: VisualDeclarationItem
  disabled?: boolean
}>()

const emit = defineEmits<{
  edit: []
  remove: []
  addField: []
}>()

const { t } = useI18n()

const fields = computed(() => props.item.fields ?? [])
const isComposed = computed(() => fields.value.length > 0)
const aliasExpr = computed(() => typeExpressionOf(props.item.text))
</script>

<template>
  <article
    class="group flex min-h-[140px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
  >
    <header
      class="flex items-center gap-2 border-b border-border-subtle bg-accent/10 px-3 py-2"
    >
      <h4 class="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-content-primary">
        {{ item.name }}
      </h4>
      <VisualEntityMenu :disabled="disabled" @edit="emit('edit')" @remove="emit('remove')" />
    </header>
    <ul v-if="isComposed" class="min-h-0 flex-1 divide-y divide-border-subtle/80">
      <li
        v-for="field in fields"
        :key="`${item.name}-${field.name}`"
        class="flex items-baseline justify-between gap-2 px-3 py-1.5 text-[12px] transition-colors group-hover:bg-surface-overlay/40"
      >
        <span class="truncate font-mono text-content-primary">{{ field.name }}</span>
        <span class="shrink-0 font-mono text-content-muted">{{ field.type }}</span>
      </li>
    </ul>
    <p v-else class="flex-1 px-3 py-3 font-mono text-[12px] text-content-secondary">
      = {{ aliasExpr }}
    </p>
    <button
      type="button"
      class="mt-auto border-t border-dashed border-border-subtle px-3 py-1.5 text-left text-[11px] text-content-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40"
      :disabled="disabled"
      @click="emit('addField')"
    >
      {{ t('visual.addField') }}
    </button>
  </article>
</template>
