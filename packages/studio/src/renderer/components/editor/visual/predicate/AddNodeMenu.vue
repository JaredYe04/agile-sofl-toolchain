<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AddNodeKind } from './predicateTypes'

const props = defineProps<{ disabled?: boolean; blockInformal?: boolean }>()
const emit = defineEmits<{ select: [kind: AddNodeKind] }>()

const { t } = useI18n()
const open = ref(false)

const options: { kind: AddNodeKind; labelKey: string }[] = [
  { kind: 'literal-true', labelKey: 'visual.predicate.addTrue' },
  { kind: 'literal-false', labelKey: 'visual.predicate.addFalse' },
  { kind: 'informal', labelKey: 'visual.predicate.addInformal' },
  { kind: 'expr', labelKey: 'visual.predicate.addExpr' },
  { kind: 'relational', labelKey: 'visual.predicate.addRelational' },
  { kind: 'quantified-forall', labelKey: 'visual.predicate.addForall' },
  { kind: 'quantified-exists', labelKey: 'visual.predicate.addExists' },
  { kind: 'and', labelKey: 'visual.predicate.addAnd' },
  { kind: 'or', labelKey: 'visual.predicate.addOr' }
]

const visibleOptions = computed(() =>
  props.blockInformal ? options.filter((o) => o.kind !== 'informal') : options
)

function pick(kind: AddNodeKind): void {
  emit('select', kind)
  open.value = false
}
</script>

<template>
  <div class="relative inline-block">
    <button
      type="button"
      class="text-xs text-accent hover:underline disabled:opacity-40"
      :disabled="disabled"
      @click="open = !open"
    >
      {{ t('visual.predicate.addNode') }}
    </button>
    <ul
      v-if="open"
      class="absolute left-0 z-30 mt-1 min-w-[10rem] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
    >
      <li
        v-for="opt in visibleOptions"
        :key="opt.kind"
        class="cursor-pointer px-3 py-1 text-xs text-content-primary hover:bg-surface-overlay"
        @mousedown.prevent="pick(opt.kind)"
      >
        {{ t(opt.labelKey) }}
      </li>
    </ul>
  </div>
</template>
