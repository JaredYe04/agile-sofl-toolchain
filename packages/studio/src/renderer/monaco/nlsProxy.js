/**
 * ESM NLS proxy for Monaco Editor 0.52+ with monaco-editor-nls-adapter.
 * Includes getNLSLanguage/getNLSMessages required by platform.js and workers.
 */

const globalObj = typeof globalThis !== 'undefined' ? globalThis : window
globalObj.__MONACO_NLS_ADAPTER_STATE__ = globalObj.__MONACO_NLS_ADAPTER_STATE__ || {
  data: null,
  name: ''
}

const getState = () => globalObj.__MONACO_NLS_ADAPTER_STATE__
const FORMAT_REGEX = /\{(\d+)\}/g

function _format(message, args) {
  if (!args || args.length === 0) return message
  return String(message).replace(FORMAT_REGEX, (match, index) => {
    const replacement = args[parseInt(index, 10)]
    return typeof replacement !== 'undefined' ? replacement : match
  })
}

export function localize(path, data, defaultMessage, ...args) {
  const key = data && typeof data === 'object' ? data.key : data
  const state = getState()
  const fileData = state.data && state.data[path]
  const message = fileData ? fileData[key] : undefined
  const finalMessage =
    message !== undefined && message !== null && message !== '' ? message : defaultMessage
  return args.length > 0 ? _format(finalMessage, args) : finalMessage
}

export function localize2(path, data, defaultMessage, ...args) {
  const value = localize(path, data, defaultMessage, ...args)
  return { value, original: value }
}

export function setLocaleData(data, locale = 'custom') {
  const state = getState()
  state.data = data
  state.name = locale
}

export function getLocaleData() {
  return getState().data
}

export function getLocaleName() {
  return getState().name
}

export function getConfiguredDefaultLocale() {
  return undefined
}

export function loadMessageBundle() {
  return localize
}

export function config() {
  return loadMessageBundle
}

export function create(key) {
  return {
    localize: (idx, def, ...args) => localize(key, idx, def, ...args),
    localize2: (idx, def, ...args) => localize2(key, idx, def, ...args),
    getConfiguredDefaultLocale: () => undefined
  }
}

export function getNLSLanguage() {
  const name = getState().name
  return name || undefined
}

export function getNLSMessages() {
  return globalObj._VSCODE_NLS_MESSAGES || []
}
