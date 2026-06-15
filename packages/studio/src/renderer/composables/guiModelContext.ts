import type { InjectionKey } from 'vue'
import type { useGuiModel } from './useGuiModel'

export const GUI_MODEL_KEY: InjectionKey<ReturnType<typeof useGuiModel>> = Symbol('guiModel')
