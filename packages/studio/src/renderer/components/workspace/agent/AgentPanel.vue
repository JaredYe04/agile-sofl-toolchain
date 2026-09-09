<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../../stores/workspace'
import { useModalStore } from '../../../stores/modal'
import type { AgentSessionPayload, InformalPatchPayload } from '../../../../preload/index'
import ClarificationCard from './ClarificationCard.vue'
import PatchPreview from './PatchPreview.vue'
import { toggleClarificationDraft, type ClarificationDraft } from './clarificationDraft'

type MenuAction = 'copy' | 'rename' | 'delete' | 'pin' | 'archive'
type AgentMessageView = AgentSessionPayload['messages'][0]

const props = defineProps<{
  informalMarkdown: string
  onApplyPatch: (patch: InformalPatchPayload) => Promise<{ ok: boolean; error?: string }>
}>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const modal = useModalStore()
const sessions = ref<AgentSessionPayload[]>([])
const session = ref<AgentSessionPayload | null>(null)
const input = ref('')
const busy = ref(false)
const error = ref('')
const configured = ref(true)
const thread = ref<HTMLElement | null>(null)
const showArchived = ref(false)
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const menu = ref<{ x: number; y: number; id: string } | null>(null)
const cardOpen = ref<Record<string, boolean>>({})
const drafts = ref<Record<string, ClarificationDraft>>({})
const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const projectRoot = computed(() => workspace.activeProject?.rootPath ?? '')
const visibleSessions = computed(() =>
  sessions.value.filter((s) => (showArchived.value ? s.archived : !s.archived))
)
const lastClarificationId = computed(() => {
  const asks = session.value?.messages.filter((m) => m.clarification) ?? []
  return asks[asks.length - 1]?.id
})
const visibleMessages = computed(
  () => session.value?.messages.filter((m) => m.role !== 'tool') ?? []
)

function ctx() {
  return {
    projectName: workspace.activeProject?.name,
    moduleId: workspace.selectedModuleName ?? 'project',
    informalMarkdown: props.informalMarkdown,
    selectedNodeId: workspace.informalSelectedNodeId ?? undefined,
    skillId: session.value?.context.skillId || 'requirement-discovery'
  }
}

function isCardExpanded(id: string): boolean {
  if (cardOpen.value[id] != null) return cardOpen.value[id]
  return id === lastClarificationId.value
}

function toggleCard(id: string): void {
  cardOpen.value = { ...cardOpen.value, [id]: !isCardExpanded(id) }
}

async function refresh(): Promise<void> {
  if (!projectRoot.value || !window.studio?.agentListSessions) return
  sessions.value = await window.studio.agentListSessions(projectRoot.value)
  const status = await window.studio.llmStatus?.()
  configured.value = status?.configured ?? false
}

async function ensureSession(): Promise<AgentSessionPayload | null> {
  if (session.value) return session.value
  if (!projectRoot.value || !window.studio?.agentCreateSession) return null
  session.value = await window.studio.agentCreateSession({
    projectRoot: projectRoot.value,
    moduleId: workspace.selectedModuleName ?? 'project'
  })
  await refresh()
  return session.value
}

async function send(text?: string): Promise<void> {
  const body = (text ?? input.value).trim()
  if (!body || busy.value) return
  error.value = ''
  if (!configured.value) {
    error.value = t('agent.missingKey')
    return
  }
  const pendingId = session.value?.context.pendingToolCallId
  if (pendingId) {
    input.value = ''
    await resume(pendingId, body, true)
    return
  }
  const current = await ensureSession()
  if (!current || !window.studio?.agentChat) return
  busy.value = true
  input.value = ''
  try {
    session.value = await window.studio.agentChat({
      projectRoot: projectRoot.value,
      sessionId: current.id,
      text: body,
      context: ctx()
    })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    await nextTick()
    thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' })
  }
}

async function resume(toolCallId: string, result: string, continueTurn = false): Promise<void> {
  if (!session.value || !window.studio?.agentResume) return
  busy.value = true
  try {
    session.value = await window.studio.agentResume({
      projectRoot: projectRoot.value,
      sessionId: session.value.id,
      toolCallId,
      result,
      context: ctx(),
      continueTurn
    })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    await nextTick()
    thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' })
  }
}

async function applyPatch(msg: AgentMessageView): Promise<void> {
  if (!msg.proposedChanges) return
  const result = await props.onApplyPatch(JSON.parse(JSON.stringify(msg.proposedChanges)))
  if (!result.ok) {
    error.value = result.error || t('agent.applyFailed')
    return
  }
  error.value = ''
  const toolId = session.value?.context.pendingToolCallId
  if (!toolId) return
  await resume(toolId, JSON.stringify({ action: 'applied' }), false)
}

async function rejectPatch(_msg: AgentMessageView): Promise<void> {
  const toolId = session.value?.context.pendingToolCallId
  if (!toolId) return
  await resume(toolId, JSON.stringify({ action: 'rejected' }), false)
}

async function answer(msg: AgentMessageView, value: string): Promise<void> {
  const toolId = msg.clarification?.pendingToolCallId || session.value?.context.pendingToolCallId
  if (!toolId) return
  const nextDrafts = { ...drafts.value }
  delete nextDrafts[msg.id]
  drafts.value = nextDrafts
  await resume(toolId, value, true)
}

function messageText(msg: AgentMessageView): string {
  return (msg.content || msg.thinking || '').trim()
}

async function copyMessage(msg: AgentMessageView): Promise<void> {
  const text = messageText(msg)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    error.value = t('agent.copyFailed')
    return
  }
  copiedId.value = msg.id
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    if (copiedId.value === msg.id) copiedId.value = null
  }, 1600)
}

async function forkFromMessage(msg: AgentMessageView): Promise<void> {
  if (!session.value || busy.value || !window.studio?.agentForkSession) return
  const copy = await window.studio.agentForkSession({
    projectRoot: projectRoot.value,
    id: session.value.id,
    throughMessageId: msg.id,
    mode: 'keep',
    title: t('agent.forkedTitle', { title: session.value.title })
  })
  if (copy) session.value = copy
  await refresh()
}

async function reopenClarification(msg: AgentMessageView, optionId: string): Promise<void> {
  if (!session.value || busy.value) return
  if (!msg.clarification?.pendingToolCallId) return
  const { index } = await modal.show({
    title: t('agent.changeAnswerTitle'),
    message: t('agent.changeAnswerMessage'),
    buttons: [t('agent.changeAnswerFork'), t('agent.changeAnswerOverwrite'), t('agent.changeAnswerNo')],
    buttonVariants: ['accent', 'warning', 'default']
  })
  if (index === 2) return
  const draft = toggleClarificationDraft(msg.clarification, optionId)
  if (index === 0) {
    const copy = await window.studio?.agentForkSession?.({
      projectRoot: projectRoot.value,
      id: session.value.id,
      throughMessageId: msg.id,
      mode: 'reset',
      title: t('agent.forkedTitle', { title: session.value.title })
    })
    if (!copy) return
    drafts.value = { ...drafts.value, [msg.id]: draft }
    cardOpen.value = { ...cardOpen.value, [msg.id]: true }
    session.value = copy
    await refresh()
    return
  }
  const next = await window.studio?.agentRewindSession?.({
    projectRoot: projectRoot.value,
    id: session.value.id,
    throughMessageId: msg.id,
    mode: 'reset'
  })
  if (!next) return
  drafts.value = { ...drafts.value, [msg.id]: draft }
  cardOpen.value = { ...cardOpen.value, [msg.id]: true }
  session.value = next
  await refresh()
}

async function newSession(): Promise<void> {
  if (!projectRoot.value || !window.studio?.agentCreateSession) return
  session.value = await window.studio.agentCreateSession({
    projectRoot: projectRoot.value,
    moduleId: workspace.selectedModuleName ?? 'project'
  })
  await refresh()
}

async function openSession(id: string): Promise<void> {
  if (!window.studio?.agentLoadSession) return
  session.value = await window.studio.agentLoadSession({ projectRoot: projectRoot.value, id })
}

function startRename(id: string, title: string): void {
  renamingId.value = id
  renameDraft.value = title
  menu.value = null
}

async function commitRename(): Promise<void> {
  const id = renamingId.value
  if (!id || !renameDraft.value.trim()) {
    renamingId.value = null
    return
  }
  const next = await window.studio?.agentRenameSession?.({
    projectRoot: projectRoot.value,
    id,
    title: renameDraft.value.trim()
  })
  renamingId.value = null
  if (next && session.value?.id === id) session.value = next
  await refresh()
}

async function onMenu(action: MenuAction): Promise<void> {
  const id = menu.value?.id
  menu.value = null
  if (!id) return
  const target = sessions.value.find((s) => s.id === id)
  if (action === 'rename' && target) {
    startRename(id, target.title)
    return
  }
  if (action === 'copy') {
    const copy = await window.studio?.agentDuplicateSession?.({ projectRoot: projectRoot.value, id })
    if (copy) session.value = copy
    await refresh()
    return
  }
  if (action === 'delete') {
    await window.studio?.agentDeleteSession?.({ projectRoot: projectRoot.value, id })
    if (session.value?.id === id) session.value = null
    await refresh()
    return
  }
  if (action === 'pin') {
    await window.studio?.agentFlagSession?.({
      projectRoot: projectRoot.value,
      id,
      flag: 'pinned',
      value: !target?.pinned
    })
    await refresh()
    return
  }
  if (action === 'archive') {
    await window.studio?.agentFlagSession?.({
      projectRoot: projectRoot.value,
      id,
      flag: 'archived',
      value: !target?.archived
    })
    if (session.value?.id === id && !showArchived.value) session.value = null
    await refresh()
  }
}

function openMenu(e: MouseEvent, id: string): void {
  e.preventDefault()
  menu.value = { x: e.clientX, y: e.clientY, id }
}

onMounted(() => {
  void refresh()
  const closeMenu = () => {
    menu.value = null
  }
  document.addEventListener('mousedown', closeMenu)
  const unsub = window.studio?.onAgentDelta?.((payload) => {
    if (payload.kind === 'session' && payload.session) {
      if (!session.value || session.value.id === payload.sessionId) session.value = payload.session
      void refresh()
      return
    }
    if (!session.value || session.value.id !== payload.sessionId || !payload.messageId) return
    const msg = session.value.messages.find((m) => m.id === payload.messageId)
    if (!msg) return
    if (payload.kind === 'reasoning') msg.thinking = payload.text
    if (payload.kind === 'content') msg.content = payload.text
  })
  onUnmounted(() => {
    document.removeEventListener('mousedown', closeMenu)
    unsub?.()
    if (copiedTimer) clearTimeout(copiedTimer)
  })
})

watch(projectRoot, () => {
  session.value = null
  void refresh()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface-raised">
    <header class="flex h-9 shrink-0 items-center gap-2 border-b border-border-subtle px-2">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <h3 class="truncate text-[12px] font-semibold text-content-primary">{{ t('agent.title') }}</h3>
    </header>
    <div class="flex min-h-0 flex-1">
      <aside class="hidden w-[168px] shrink-0 flex-col border-r border-border-subtle sm:flex">
        <button
          type="button"
          class="m-1.5 rounded-md border border-dashed border-border-subtle px-2 py-1.5 text-left text-[11px] text-content-secondary transition-colors hover:border-content-primary/30 hover:bg-surface-overlay active:bg-surface-base"
          @click="newSession"
        >
          + {{ t('agent.newSession') }}
        </button>
        <div class="min-h-0 flex-1 overflow-auto px-1.5 pb-1.5 studio-scroll">
          <button
            v-for="s in visibleSessions"
            :key="s.id"
            type="button"
            class="mb-0.5 flex w-full items-center rounded-md px-1.5 py-1 text-left text-[11px] transition-colors"
            :class="
              session?.id === s.id
                ? 'bg-content-primary/10 text-content-primary'
                : 'text-content-secondary hover:bg-surface-overlay active:bg-surface-base'
            "
            @click="openSession(s.id)"
            @contextmenu="openMenu($event, s.id)"
            @dblclick.stop="startRename(s.id, s.title)"
          >
            <span v-if="s.pinned" class="mr-1 text-[10px] text-content-muted">📌</span>
            <input
              v-if="renamingId === s.id"
              v-model="renameDraft"
              class="min-w-0 flex-1 rounded border border-field-border bg-field-bg px-1 py-0.5 text-[11px]"
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.esc="renamingId = null"
              @blur="commitRename"
            />
            <span v-else class="min-w-0 flex-1 truncate">{{ s.title }}</span>
          </button>
          <p v-if="!visibleSessions.length" class="px-1 py-2 text-[11px] text-content-muted">
            {{ t('agent.noSessions') }}
          </p>
        </div>
        <button
          type="button"
          class="border-t border-border-subtle px-2 py-1 text-left text-[10px] text-content-muted hover:bg-surface-overlay"
          @click="showArchived = !showArchived"
        >
          {{ showArchived ? t('agent.hideArchived') : t('agent.showArchived') }}
        </button>
      </aside>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref="thread" class="min-h-0 flex-1 overflow-auto p-3 studio-scroll">
          <p v-if="!visibleMessages.length" class="text-[13px] leading-relaxed text-content-secondary">
            {{ t('agent.emptyHint') }}
          </p>
          <div v-for="msg in visibleMessages" :key="msg.id" class="mb-3">
            <div
              class="agent-bubble studio-text-selectable max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
              :class="msg.role === 'user' ? 'agent-bubble-user ml-auto' : 'agent-bubble-assistant'"
            >
              <details
                v-if="msg.thinking"
                class="mb-2 text-[12px] text-content-muted"
                :open="msg.streaming && !msg.content"
              >
                <summary class="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wide">
                  {{ msg.streaming && !msg.content ? t('agent.thinking') : t('agent.thought') }}
                </summary>
                <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed studio-scroll">{{ msg.thinking }}</pre>
              </details>
              <p v-if="msg.content" class="cursor-text whitespace-pre-wrap">{{ msg.content }}</p>
              <p v-else-if="msg.streaming" class="text-[12px] text-content-muted">{{ t('agent.thinking') }}</p>
              <div
                v-if="!msg.streaming || msg.content"
                class="mt-2 flex cursor-default select-none gap-1 border-t border-border-subtle pt-1.5"
              >
                <button
                  type="button"
                  class="rounded-md px-1.5 py-0.5 text-[11px] text-content-muted hover:bg-surface-overlay hover:text-content-primary disabled:opacity-40"
                  :disabled="!messageText(msg)"
                  @click="copyMessage(msg)"
                >
                  {{ copiedId === msg.id ? t('agent.copied') : t('agent.copyText') }}
                </button>
                <button
                  type="button"
                  class="rounded-md px-1.5 py-0.5 text-[11px] text-content-muted hover:bg-surface-overlay hover:text-content-primary disabled:opacity-40"
                  :disabled="busy || Boolean(msg.streaming)"
                  @click="forkFromMessage(msg)"
                >
                  {{ t('agent.forkChat') }}
                </button>
              </div>
            </div>
            <ClarificationCard
              v-if="msg.clarification"
              :question="msg.clarification.question"
              :options="msg.clarification.options"
              :allow-custom="msg.clarification.allowCustom"
              :multi-select="msg.clarification.multiSelect"
              :disabled="busy"
              :pending="Boolean(msg.pending)"
              :answer="msg.clarification.answer"
              :expanded="isCardExpanded(msg.id)"
              :prefill-ids="drafts[msg.id]?.ids"
              :prefill-custom="drafts[msg.id]?.custom"
              @toggle="toggleCard(msg.id)"
              @submit="answer(msg, $event)"
              @change="reopenClarification(msg, $event)"
            />
            <PatchPreview
              v-if="msg.proposedChanges"
              :patch="msg.proposedChanges"
              :disabled="busy"
              :pending="Boolean(msg.pending)"
              :resolution="msg.resolution"
              @apply="applyPatch(msg)"
              @reject="rejectPatch(msg)"
            />
            <ul v-if="msg.review?.issues?.length" class="agent-bubble mt-2 space-y-1 rounded-xl bg-surface-base p-2">
              <li v-for="(issue, i) in msg.review.issues" :key="i" class="text-[12px] text-content-secondary">
                <span class="font-semibold uppercase tracking-wide text-content-muted">{{ issue.dimension }}</span>
                — {{ issue.message }}
              </li>
            </ul>
          </div>
          <p v-if="error" class="text-[12px] text-rose-500">{{ error }}</p>
        </div>
        <form class="flex shrink-0 gap-2 border-t border-border-subtle p-2" @submit.prevent="send()">
          <input
            v-model="input"
            class="min-w-0 flex-1 rounded-lg border border-field-border bg-field-bg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent/30"
            :placeholder="t('agent.placeholder')"
            :disabled="busy"
          />
          <button
            type="submit"
            class="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-accent-fg disabled:opacity-40"
            :disabled="busy || !input.trim()"
          >
            {{ t('agent.send') }}
          </button>
        </form>
      </div>
    </div>
    <div
      v-if="menu"
      class="fixed z-[120] min-w-[148px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @mousedown.stop
      @click.stop
    >
      <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" @click="onMenu('copy')">
        {{ t('agent.menu.copy') }}
      </button>
      <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" @click="onMenu('rename')">
        {{ t('agent.menu.rename') }}
      </button>
      <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" @click="onMenu('pin')">
        {{ t('agent.menu.pin') }}
      </button>
      <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" @click="onMenu('archive')">
        {{ t('agent.menu.archive') }}
      </button>
      <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] text-danger hover:bg-surface-overlay" @click="onMenu('delete')">
        {{ t('agent.menu.delete') }}
      </button>
    </div>
  </section>
</template>
