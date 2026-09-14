import { isProxy, toRaw } from 'vue'

/** Strip Vue proxies / class instances so Electron structured-clone IPC succeeds. */
export function toIpcValue<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(unwrap(value), (_key, nested) => {
      if (nested && typeof nested === 'object' && isProxy(nested)) return toRaw(nested)
      return nested
    })
  ) as T
}

function unwrap(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value
  return isProxy(value) ? toRaw(value) : value
}
