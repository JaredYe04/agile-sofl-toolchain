/** Return a value safe for Electron structured-clone IPC (strips Proxies, Maps, etc.). */
export function cloneForIpc<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
