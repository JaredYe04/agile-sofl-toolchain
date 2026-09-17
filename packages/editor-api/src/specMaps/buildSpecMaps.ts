import {
  architectureFromHybrid,
  architectureFromInformal,
  dataflowFromHybrid,
  dataflowFromInformal,
  lifecycleFromHybrid,
  sequenceFromInformal,
  workflowFromHybrid,
  workflowFromInformal
} from './fromHybrid.js'
import { architectureGuiBindings, lifecycleFromGui, sequenceFromGui } from './fromGui.js'
import type { SpecMap, SpecMapKind, SpecMapSource } from './types.js'
import { capSpecMap, emptySpecMap } from './util.js'

function firstMap(...maps: Array<SpecMap | null | undefined>): SpecMap | null {
  return maps.find((m) => m && m.nodes.length > 0) ?? null
}

export function buildArchitecture(source: SpecMapSource): SpecMap {
  const map = firstMap(architectureFromHybrid(source.hybrid), architectureFromInformal(source.informal))
  if (!map) {
    return emptySpecMap('architecture', source.hybrid || source.informal ? 'no-hybrid-modules' : 'no-specification')
  }
  architectureGuiBindings(source.gui, map)
  return capSpecMap(map)
}

export function buildWorkflow(source: SpecMapSource): SpecMap {
  const map = firstMap(workflowFromHybrid(source.hybrid), workflowFromInformal(source.informal))
  return capSpecMap(map ?? emptySpecMap('workflow', 'no-process-flow'))
}

export function buildSequence(source: SpecMapSource): SpecMap {
  const map = firstMap(sequenceFromGui(source.gui), sequenceFromInformal(source.informal))
  return capSpecMap(map ?? emptySpecMap('sequence', 'no-gui-flows'))
}

export function buildDataflow(source: SpecMapSource): SpecMap {
  const map = firstMap(dataflowFromHybrid(source.hybrid), dataflowFromInformal(source.informal))
  return capSpecMap(map ?? emptySpecMap('dataflow', 'no-data-flow'))
}

export function buildLifecycle(source: SpecMapSource): SpecMap {
  const map = firstMap(lifecycleFromGui(source.gui), lifecycleFromHybrid(source.hybrid))
  return capSpecMap(map ?? emptySpecMap('lifecycle', 'no-lifecycle-states'))
}

export function buildSpecMap(kind: SpecMapKind, source: SpecMapSource): SpecMap {
  switch (kind) {
    case 'architecture':
      return buildArchitecture(source)
    case 'workflow':
      return buildWorkflow(source)
    case 'sequence':
      return buildSequence(source)
    case 'dataflow':
      return buildDataflow(source)
    case 'lifecycle':
      return buildLifecycle(source)
  }
}

export function buildSpecMaps(source: SpecMapSource): Record<SpecMapKind, SpecMap> {
  return {
    architecture: buildArchitecture(source),
    workflow: buildWorkflow(source),
    sequence: buildSequence(source),
    dataflow: buildDataflow(source),
    lifecycle: buildLifecycle(source)
  }
}
