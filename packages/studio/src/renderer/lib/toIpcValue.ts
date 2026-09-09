/** Strip Vue proxies / class instances so Electron structured-clone IPC succeeds. */
export function toIpcValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
