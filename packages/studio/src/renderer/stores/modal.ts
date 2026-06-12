import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ModalRequest = {
  title: string
  message?: string
  buttons: string[]
  input?: boolean
  inputValue?: string
  inputPlaceholder?: string
  checkbox?: boolean
  checkboxLabel?: string
  checkboxValue?: boolean
  resolve: (index: number, inputValue?: string, checkboxValue?: boolean) => void
}

export const useModalStore = defineStore('modal', () => {
  const request = ref<ModalRequest | null>(null)

  function show(options: {
    title: string
    message?: string
    buttons: string[]
    input?: boolean
    inputValue?: string
    inputPlaceholder?: string
    checkbox?: boolean
    checkboxLabel?: string
    checkboxValue?: boolean
  }): Promise<{ index: number; value?: string; checked?: boolean }> {
    return new Promise((resolve) => {
      request.value = {
        ...options,
        resolve: (index, value, checked) => resolve({ index, value, checked })
      }
    })
  }

  function respond(index: number, value?: string, checked?: boolean): void {
    const req = request.value
    request.value = null
    req?.resolve(index, value, checked)
  }

  function dismiss(): void {
    const req = request.value
    request.value = null
    if (req) req.resolve(req.buttons.length - 1)
  }

  return { request, show, respond, dismiss }
})
