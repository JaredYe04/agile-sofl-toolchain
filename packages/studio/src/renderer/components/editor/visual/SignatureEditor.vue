<script setup lang="ts">

import { ref, watch, computed } from 'vue'

import { useI18n } from 'vue-i18n'

import type { ParamGroupItem } from '../../../preload/index'

import FormField from './ui/FormField.vue'

import TextField from './ui/TextField.vue'

import ParamGroupEditor from './ParamGroupEditor.vue'



const props = defineProps<{

  kind: 'process' | 'function'

  signature: string

  inputs?: ParamGroupItem[]

  outputs?: ParamGroupItem[]

  params?: ParamGroupItem[]

  returnType?: string

  disabled?: boolean

}>()



const emit = defineEmits<{

  patch: [signature: string]

}>()



const { t } = useI18n()

const codeMode = ref(false)

const codeDraft = ref('')

const inputGroups = ref<ParamGroupItem[]>([])

const outputGroups = ref<ParamGroupItem[]>([])

const paramGroups = ref<ParamGroupItem[]>([])

const returnDraft = ref('nat')

const validationError = ref<string | null>(null)



watch(

  () => [props.signature, props.inputs, props.outputs, props.params, props.returnType] as const,

  ([sig, inputs, outputs, params, ret]) => {

    codeDraft.value = sig

    inputGroups.value = (inputs ?? []).map((g) => ({ ...g }))

    outputGroups.value = (outputs ?? []).map((g) => ({ ...g }))

    paramGroups.value = (params ?? []).map((g) => ({ ...g }))

    returnDraft.value = ret ?? 'nat'

    validationError.value = null

  },

  { immediate: true, deep: true }

)



function buildProcessSig(inputs: ParamGroupItem[], outputs: ParamGroupItem[]): string {

  const inPart = inputs

    .filter((g) => g.names.trim() || g.type.trim())

    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)

    .join(', ')

  const header = `(${inPart})`

  const outPart = outputs

    .filter((g) => g.names.trim() || g.type.trim())

    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)

    .join(', ')

  return outPart ? `${header} ${outPart}` : header

}



function buildFunctionSig(params: ParamGroupItem[], returnType: string): string {

  const paramPart = params

    .filter((g) => g.names.trim() || g.type.trim())

    .map((g) => `${g.names.trim()}: ${g.type.trim()}`)

    .join(', ')

  return `(${paramPart}): ${returnType.trim() || 'nat'}`

}



const structuredSignature = computed(() =>

  props.kind === 'process'

    ? buildProcessSig(inputGroups.value, outputGroups.value)

    : buildFunctionSig(paramGroups.value, returnDraft.value)

)



async function validate(sig: string): Promise<boolean> {
  const result = await window.studio.validateSignature(props.kind, sig)
  if (!result.ok) {
    validationError.value = result.error
    return false
  }
  validationError.value = null
  return true
}

async function tryEmit(sig: string): Promise<void> {
  if (props.disabled || sig === props.signature) return
  if (!(await validate(sig))) return
  emit('patch', sig)
}



watch(codeDraft, (text) => {

  if (!codeMode.value) return

  tryEmit(text)

})



watch(structuredSignature, (text) => {

  if (codeMode.value) return

  tryEmit(text)

})



const label = () =>

  props.kind === 'process' ? t('visual.processSignature') : t('visual.functionSignature')

</script>



<template>

  <div>

    <div class="mb-2 flex items-center justify-between">

      <span class="text-sm font-medium text-content-primary">{{ label() }}</span>

      <button

        type="button"

        class="text-xs text-accent hover:underline"

        @click="codeMode = !codeMode"

      >

        {{ codeMode ? t('visual.signature.visualMode') : t('visual.signature.codeMode') }}

      </button>

    </div>



    <TextField v-if="codeMode" v-model="codeDraft" mono :disabled="disabled" />



    <div v-else class="space-y-4">

      <template v-if="kind === 'process'">

        <ParamGroupEditor

          :groups="inputGroups"

          :label="t('visual.params.inputs')"

          :disabled="disabled"

          @patch="inputGroups = $event"

        />

        <ParamGroupEditor

          :groups="outputGroups"

          :label="t('visual.params.outputs')"

          :disabled="disabled"

          @patch="outputGroups = $event"

        />

      </template>

      <template v-else>

        <ParamGroupEditor

          :groups="paramGroups"

          :label="t('visual.params.parameters')"

          :disabled="disabled"

          @patch="paramGroups = $event"

        />

        <FormField :label="t('visual.params.returnType')">

          <TextField v-model="returnDraft" mono :disabled="disabled" />

        </FormField>

      </template>

      <p class="font-mono text-xs text-content-muted">{{ structuredSignature }}</p>

    </div>



    <p v-if="validationError" class="mt-2 text-xs text-semantic-error">{{ validationError }}</p>

  </div>

</template>

