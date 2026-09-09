<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { useHistoryStore } from '../../stores/history'
import { HistoryKinds } from '../../history/kinds'

const props = defineProps<{ source: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const workspace = useWorkspaceStore()
const generators = ref<Array<{ id: string; name: string }>>([])
const generatorId = ref('rule-based')
const preview = ref('')
const warnings = ref<string[]>([])
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  generators.value = (await window.studio?.listHybridGenerators?.()) ?? [
    { id: 'rule-based', name: 'Rule-based Hybrid Generator' },
    { id: 'llm-baseline', name: 'LLM Hybrid Generator' }
  ]
  const status = await window.studio?.llmStatus?.()
  if (status?.configured) generatorId.value = 'llm-baseline'
})

async function run(): Promise<void> {
  if (!window.studio?.generateHybrid) return
  busy.value = true
  error.value = ''
  preview.value = ''
  warnings.value = []
  try {
    const result = await window.studio.generateHybrid({
      source: props.source,
      generatorId: generatorId.value,
      projectName: workspace.activeProject?.name,
      projectRoot: workspace.activeProject?.rootPath,
      existingAsfl: workspace.hybridTab?.content
    })
    if (!result.ok) {
      error.value = result.error
      return
    }
    preview.value = result.asflText
    warnings.value = result.warnings.map((w) => w.message)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function apply(): void {
  const tab = workspace.hybridTab
  if (!tab || !preview.value) return
  useHistoryStore().applyDocument(tab.id, preview.value, {
    kind: HistoryKinds.hybridEdit,
    immediate: true
  })
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" @click.self="emit('close')">
    <div class="flex max-h-[80vh] w-[min(720px,100%)] flex-col rounded-xl border border-border-subtle bg-surface-raised shadow-lg">
      <header class="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <h3 class="mr-auto text-sm font-semibold text-content-primary">{{ t('informal.generateHybrid') }}</h3>
        <button type="button" class="text-content-muted" @click="emit('close')">×</button>
      </header>
      <div class="min-h-0 flex-1 space-y-3 overflow-auto p-4 studio-scroll">
        <label class="block text-[12px] text-content-secondary">
          {{ t('informal.generator') }}
          <select v-model="generatorId" class="mt-1 w-full rounded-md border border-field-border bg-field-bg px-2 py-1.5 text-[13px]">
            <option v-for="g in generators" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </label>
        <p class="text-[12px] text-content-muted">{{ t('informal.generatorHint') }}</p>
        <pre v-if="preview" class="max-h-[320px] overflow-auto rounded-md bg-surface-base p-3 text-[12px] text-content-primary studio-scroll">{{ preview }}</pre>
        <p v-for="w in warnings" :key="w" class="text-[12px] text-amber-600">{{ w }}</p>
        <p v-if="error" class="text-[12px] text-rose-500">{{ error }}</p>
      </div>
      <footer class="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
        <button type="button" class="rounded-md border border-border-subtle px-3 py-1.5 text-[12px]" @click="emit('close')">
          {{ t('workspace.cancel') }}
        </button>
        <button type="button" class="rounded-md bg-accent/15 px-3 py-1.5 text-[12px] text-accent" :disabled="busy" @click="run">
          {{ busy ? t('informal.generating') : t('informal.previewGenerate') }}
        </button>
        <button
          v-if="preview"
          type="button"
          class="rounded-md bg-accent px-3 py-1.5 text-[12px] text-accent-fg"
          @click="apply"
        >
          {{ t('informal.applyGenerate') }}
        </button>
      </footer>
    </div>
  </div>
</template>
