import { beforeEach } from 'vitest'
import { resetDasrRuntime } from '../src/shared/dasr/runtime'
import { setDasrLogger } from '../src/shared/dasr/log'

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
  resetDasrRuntime()
  setDasrLogger(null)
})
