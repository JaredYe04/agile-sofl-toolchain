import type { InjectionKey } from 'vue'
import type { useVisualModel } from './useVisualModel'

export type VisualModelContext = ReturnType<typeof useVisualModel>

export const VISUAL_MODEL_KEY: InjectionKey<VisualModelContext> = Symbol('visualModel')
