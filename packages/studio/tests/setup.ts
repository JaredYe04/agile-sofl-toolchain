import { beforeEach } from 'vitest'

const localStore = new Map<string, string>()
const sessionStore = new Map<string, string>()

function makeStorageApi(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => {
      map.clear()
    }
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: makeStorageApi(localStore),
  writable: true
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: makeStorageApi(sessionStore),
  writable: true
})

beforeEach(() => {
  localStore.clear()
  sessionStore.clear()
})
