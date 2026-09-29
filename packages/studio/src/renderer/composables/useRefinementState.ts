import { ref, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { emptyRefinementState, type RefinementStateDto } from '../lib/refinementTypes'

/** Bumped when the audit log changes even if Hybrid source text is unchanged. */
const revision = ref(0)

export function notifyRefinementChanged(): void {
  revision.value += 1
}

export function useRefinementState() {
  const workspace = useWorkspaceStore()
  const state = ref<RefinementStateDto | null>(null)

  watch(
    () => [workspace.hybridTab?.content, workspace.activeProject?.rootPath, revision.value] as const,
    async ([source, root]) => {
      const ticket = revision.value
      const sourceAtRequest = source
      if (!source || !root || !window.studio?.refinementState) {
        state.value = null
        return
      }
      try {
        const next = (await window.studio.refinementState({
          source,
          projectRoot: root
        })) as RefinementStateDto
        if (ticket !== revision.value) return
        if (workspace.hybridTab?.content !== sourceAtRequest) return
        state.value = {
          ...emptyRefinementState(),
          ...next,
          processes: Array.isArray(next.processes)
            ? next.processes.map((p) => ({
                ...p,
                isStub: p.isStub ?? false,
                effectPattern: p.effectPattern ?? 'opaque',
                grainClass: p.grainClass ?? 'unclassified',
                nameEffectMismatch: p.nameEffectMismatch ?? false,
                variations: p.variations ?? [],
                grainClosed: p.grainClosed ?? false,
                operationallyAtomic: p.operationallyAtomic ?? false
              }))
            : [],
          grainAmbiguity: next.grainAmbiguity ?? 0,
          unloggedGrainClosures: next.unloggedGrainClosures ?? 0,
          modules: Array.isArray(next.modules)
            ? next.modules.map((m) => ({ isEmpty: false, ...m }))
            : [],
          dataItems: Array.isArray(next.dataItems) ? next.dataItems : [],
          log: Array.isArray(next.log) ? next.log : [],
          breakdown: { ...emptyRefinementState().breakdown, ...next.breakdown }
        }
      } catch {
        if (workspace.hybridTab?.content === sourceAtRequest) state.value = null
      }
    },
    { immediate: true }
  )

  return { state }
}
