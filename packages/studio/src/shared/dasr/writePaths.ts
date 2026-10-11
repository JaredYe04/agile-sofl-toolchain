/**
 * Inventory of specification write paths from the Phase 0 audit.
 * Each row is either a decision-gate call site (marker must stay in that file)
 * or an explicit exception with a reason a test locks in.
 *
 * Auto-write is not an exception: it skips the human Apply click only.
 */

export interface WritePathRow {
  id: string
  /** Short pointer back to the Phase 0 audit section. */
  audit: string
  site: string
  /** Substring that must remain in `site` when this path is gated. */
  marker?: string
  /** Path persists only by calling history.applyDocument, which runs the gate. */
  viaApplyDocument?: boolean
  exception?: boolean
  exceptionReason?: string
}

export const WRITE_PATHS: WritePathRow[] = [
  {
    id: 'propose_changes',
    audit: 'Informal CRUD',
    site: 'src/main/services/llm/agentLoop.ts',
    marker: 'dasr-gate:propose_changes'
  },
  {
    id: 'propose_changes-apply',
    audit: 'Informal CRUD apply',
    site: 'src/renderer/composables/useInformalSpec.ts',
    marker: 'dasr-gate:propose_changes'
  },
  {
    id: 'propose_hybrid_changes',
    audit: 'Hybrid CRUD',
    site: 'src/renderer/lib/applyHybridDocumentPatch.ts',
    marker: 'dasr-gate:propose_hybrid_changes'
  },
  {
    id: 'propose_refinement_step',
    audit: 'Hybrid refinement step',
    site: 'src/main/services/refinementLog.ts',
    marker: 'dasr-gate:propose_refinement_step'
  },
  {
    id: 'propose_source_edit',
    audit: 'Source edit fallback',
    site: 'src/main/services/llm/agentLoop.ts',
    marker: 'dasr-gate:propose_source_edit'
  },
  {
    id: 'propose_source_edit-hybrid',
    audit: 'Hybrid source edit',
    site: 'src/renderer/lib/applyHybridDocumentPatch.ts',
    marker: 'dasr-gate:propose_source_edit'
  },
  {
    id: 'propose_gui_changes',
    audit: 'GUI CRUD',
    site: 'src/renderer/lib/applyGuiDocumentPatch.ts',
    marker: 'dasr-gate:propose_gui_changes'
  },
  {
    id: 'propose_source_edit-gui',
    audit: 'GUI source edit',
    site: 'src/renderer/lib/applyGuiDocumentPatch.ts',
    marker: 'dasr-gate:propose_source_edit'
  },
  {
    id: 'auto-write',
    audit: 'UI auto-write',
    site: 'src/renderer/components/workspace/agent/AgentPanel.vue',
    marker: 'dasr-gate:auto-write'
  },
  {
    id: 'harness-auto-accept',
    audit: 'Headless pilot applyHybridProposal',
    site: 'scripts/agent-harness/core.ts',
    marker: 'dasr-gate:harness-auto-accept'
  },
  {
    id: 'b0-auto',
    audit: 'B0-auto generator',
    site: 'scripts/agent-harness/b0auto.ts',
    marker: 'dasr-gate:b0-auto'
  },
  {
    id: 'direct-editor',
    audit: 'Monaco and other document commits',
    site: 'src/renderer/stores/history.ts',
    marker: 'dasr-gate:direct-editor'
  },
  {
    id: 'monaco-buffer',
    audit: 'Monaco buffer',
    site: 'src/renderer/components/editor/MonacoEditor.vue',
    viaApplyDocument: true
  },
  {
    id: 'visual-editor',
    audit: 'Hybrid visual editor',
    site: 'src/renderer/composables/useVisualModel.ts',
    viaApplyDocument: true
  },
  {
    id: 'informal-graphical',
    audit: 'Informal graphical edits',
    site: 'src/renderer/composables/useInformalModel.ts',
    viaApplyDocument: true
  },
  {
    id: 'gui-designer',
    audit: 'GUI designer',
    site: 'src/renderer/composables/useGuiModel.ts',
    viaApplyDocument: true
  },
  {
    id: 'find-replace',
    audit: 'Find/replace',
    site: 'src/renderer/search/applyReplace.ts',
    marker: 'dasr-gate:find-replace'
  },
  {
    id: 'format-document',
    audit: 'Format document',
    site: 'src/renderer/composables/useFormatDocument.ts',
    viaApplyDocument: true
  },
  {
    id: 'hybrid-generator-apply',
    audit: 'Batch Hybrid generator Apply',
    site: 'src/renderer/components/workspace/HybridGenerateDialog.vue',
    viaApplyDocument: true
  },
  {
    id: 'refinement-wizard',
    audit: 'Refinement wizard',
    site: 'src/renderer/components/editor/RefinementWizard.vue',
    marker: 'dasr-gate:refinement-wizard'
  },
  {
    id: 'spec-assist-skeleton',
    audit: 'Spec-assist skeleton',
    site: 'src/renderer/specAssist/hybridSkeleton.ts',
    viaApplyDocument: true
  },
  {
    id: 'informal-regions',
    audit: 'Informal region panel',
    site: 'src/renderer/components/editor/InformalRegionsPanel.vue',
    viaApplyDocument: true
  },
  {
    id: 'informal-assist',
    audit: 'Informal assist rail',
    site: 'src/renderer/components/workspace/InformalAssistRail.vue',
    viaApplyDocument: true
  },
  {
    id: 'informal-document-view',
    audit: 'Informal document view',
    site: 'src/renderer/components/workspace/informal/DocumentView.vue',
    viaApplyDocument: true
  },
  {
    id: 'chat-prose',
    audit: 'Chat prose is not a specification write',
    site: 'src/main/services/llm/agentLoop.ts',
    exception: true,
    exceptionReason:
      'Assistant chat text is not stored as a specification. The system prompt still says writes go through propose_* tools. There is no second store write in the chat handler.'
  },
  {
    id: 'file-open',
    audit: 'Opening a project file',
    site: 'src/renderer/stores/document.ts',
    exception: true,
    exceptionReason:
      'openFromFile loads bytes already on disk. It is not a new commitment of a requirement interpretation. Edits after open go through applyDocument.'
  },
  {
    id: 'undo-redo',
    audit: 'History undo and redo',
    site: 'src/renderer/stores/history.ts',
    exception: true,
    exceptionReason:
      'Undo and redo restore a snapshot that already passed the decision gate when it was first committed. They run while history.applying is set and do not call applyDocument.'
  },
  {
    id: 'informal-display-normalize',
    audit: 'Informal display source normalization',
    site: 'src/renderer/composables/useInformalSpec.ts',
    exception: true,
    exceptionReason:
      'parseInformalSpec may replace the buffer with displaySource for the same loaded specification. That normalization is not a new element commitment. Later edits use applyPatch, which is gated.'
  },
  {
    id: 'file-save',
    audit: 'Saving the editor buffer to disk',
    site: 'src/renderer/composables/useFileActions.ts',
    exception: true,
    exceptionReason:
      'fileWrite persists the editor buffer. Changing that buffer goes through applyDocument or a gated apply helper. The save itself does not apply a new patch.'
  },
  {
    id: 'c1-flag-off',
    audit: 'Study A condition C1',
    site: 'src/shared/dasr/flag.ts',
    exception: true,
    exceptionReason:
      'When the DASR flag is C1 the decision gate is not applied, so existing projects keep their current write behavior. C1 is a study switch. It is not an assumption that missing targets have no impact. C2 fails closed on missing or unknown targets.'
  }
]
