import type { InjectionKey } from 'vue'
import type { useInformalModel } from './useInformalModel'

export const INFORMAL_MODEL_KEY: InjectionKey<ReturnType<typeof useInformalModel>> = Symbol('informalModel')
