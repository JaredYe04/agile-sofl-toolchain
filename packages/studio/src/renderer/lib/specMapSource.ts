import type {
  GuiMapInput,
  HybridMapInput,
  InformalMapInput,
  InformalMapNode,
  SpecMapSource
} from '@agile-sofl/editor-api'
import { nestedNodes } from '../composables/useInformalSpec'
import type { InformalNodePayload, InformalSpecPayload, VisualModelPayload } from '../../preload/index'
import type { GuiDocumentModel } from '@agile-sofl/gui'

function mapInformalNode(node: InformalNodePayload): InformalMapNode {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    children: nestedNodes(node).map(mapInformalNode)
  }
}

export function informalToMapInput(spec: InformalSpecPayload | null | undefined): InformalMapInput | null {
  if (!spec?.sections?.length) return null
  return {
    sections: spec.sections.map((section) => ({
      type: section.type,
      title: section.title,
      children: (section.children ?? []).map(mapInformalNode)
    }))
  }
}

export function hybridToMapInput(model: VisualModelPayload | null | undefined): HybridMapInput | null {
  if (!model?.modules?.length) return null
  return {
    modules: model.modules.map((mod) => ({
      name: mod.name,
      isSystem: mod.isSystem,
      parentName: mod.parentName,
      processes: mod.processes.map((p) => ({
        name: p.name,
        decom: p.decom,
        isInit: p.isInit,
        inputs: p.inputs,
        outputs: p.outputs,
        ext: p.ext
      })),
      functions: mod.functions.map((fn) => ({ name: fn.name })),
      types: mod.types.map((t) => ({ name: t.name })),
      vars: mod.vars.map((v) => ({ name: v.name })),
      gui: mod.gui
        ? {
            screens: mod.gui.screens.map((s) => ({
              name: s.name,
              triggersProcess: s.triggersProcess
            }))
          }
        : undefined
    })),
    fsfModels: (model.fsfModels as HybridMapInput['fsfModels']) ?? []
  }
}

export function guiToMapInput(model: GuiDocumentModel | null | undefined): GuiMapInput | null {
  if (!model?.screens?.length) return null
  return {
    screens: model.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      title: screen.title,
      triggersProcess: screen.triggersProcess,
      widgets: (screen.widgets ?? []).map((w) => ({
        id: w.id,
        nav: w.nav,
        process: w.process,
        action: w.action,
        events: w.events
      }))
    })),
    flows: model.flows
  }
}

export function toSpecMapSource(input: {
  informal?: InformalSpecPayload | null
  hybrid?: VisualModelPayload | null
  gui?: GuiDocumentModel | null
}): SpecMapSource {
  return {
    informal: informalToMapInput(input.informal),
    hybrid: hybridToMapInput(input.hybrid),
    gui: guiToMapInput(input.gui)
  }
}
