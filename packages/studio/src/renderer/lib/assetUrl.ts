/** Resolve public assets for both dev server and packaged file:// loading. */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  return new URL(normalized, window.location.href).toString()
}
