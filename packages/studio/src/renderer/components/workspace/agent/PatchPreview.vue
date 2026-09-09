<script setup lang="ts">
import type { InformalPatchPayload } from '../../../../preload/index'

const props = defineProps<{
  patch: InformalPatchPayload
  disabled?: boolean
  pending?: boolean
  resolution?: 'applied' | 'rejected' | 'answered'
}>()
const emit = defineEmits<{ apply: []; reject: [] }>()

function verb(op: Record<string, unknown>): string {
  const kind = String(op.op || '')
  if (kind === 'add') return '+'
  if (kind === 'remove') return '−'
  if (kind === 'move') return '↕'
  return '~'
}

function label(op: Record<string, unknown>): string {
  const node = op.node as { title?: string; type?: string } | undefined
  if (op.op === 'update') {
    const bits = [op.id, op.title, op.description].filter((v) => v != null && String(v).trim())
    return bits.map(String).join(' · ')
  }
  if (node?.title) return `${node.type ?? ''} ${node.title}`.trim()
  if (op.title) return String(op.title)
  if (op.id) return String(op.id)
  return String(op.target || op.op)
}

function tone(op: Record<string, unknown>): string {
  const kind = String(op.op || '')
  if (kind === 'add') return 'text-emerald-700 dark:text-emerald-300'
  if (kind === 'remove') return 'text-rose-700 dark:text-rose-300'
  return 'text-content-secondary'
}
</script>

<template>
  <div class="agent-bubble mt-2 rounded-xl bg-surface-raised p-3">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
      {{ $t('agent.proposedChanges') }}
    </p>
    <p v-if="patch.explanation" class="studio-text-selectable mt-1 text-[13px] text-content-secondary">{{ patch.explanation }}</p>
    <ul class="mt-2 space-y-1">
      <li
        v-for="(op, i) in patch.operations"
        :key="i"
        class="flex gap-2 font-mono text-[12px]"
        :class="tone(op)"
      >
        <span class="w-4 shrink-0 font-semibold">{{ verb(op) }}</span>
        <span>{{ label(op) }}</span>
      </li>
    </ul>
    <p v-if="resolution === 'applied'" class="mt-2 text-[12px] text-content-muted">{{ $t('agent.applied') }}</p>
    <p v-else-if="resolution === 'rejected'" class="mt-2 text-[12px] text-content-muted">{{ $t('agent.rejected') }}</p>
    <div v-else-if="pending" class="mt-3 flex gap-2">
      <button
        type="button"
        class="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-accent-fg disabled:opacity-40"
        :disabled="disabled"
        @click="emit('apply')"
      >
        {{ $t('agent.apply') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-border-subtle px-3 py-1 text-[12px] text-content-secondary hover:bg-surface-overlay disabled:opacity-40"
        :disabled="disabled"
        @click="emit('reject')"
      >
        {{ $t('agent.reject') }}
      </button>
    </div>
  </div>
</template>
