export function vditorCdn(): string {
  return new URL('vditor', window.location.href).href.replace(/\/?$/, '')
}

export function vditorContentTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
