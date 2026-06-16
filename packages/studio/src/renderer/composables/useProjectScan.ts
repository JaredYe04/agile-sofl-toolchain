import { ref, watch, computed, type Ref } from 'vue'
import type { ProjectScanPayload } from '../../preload/index'

export type ProjectPair = ProjectScanPayload['pairs'][number]
export type PairCompleteness = 'full' | 'partial' | 'informal-only'

export function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

export function pairCompleteness(pair: ProjectPair): PairCompleteness {
  const hasAsfl = Boolean(pair.asflPath)
  const hasGui = Boolean(pair.guispecPath)
  if (hasAsfl && hasGui) return 'full'
  if (hasAsfl || hasGui) return 'partial'
  return 'informal-only'
}

export function computeUnpaired(scan: ProjectScanPayload | null): {
  asfl: string[]
  aspec: string[]
  guispec: string[]
} {
  if (!scan) return { asfl: [], aspec: [], guispec: [] }

  const pairedAsfl = new Set(scan.pairs.map((p) => p.asflPath).filter(Boolean) as string[])
  const pairedAspec = new Set(scan.pairs.map((p) => p.aspecPath))
  const pairedGui = new Set(scan.pairs.map((p) => p.guispecPath).filter(Boolean) as string[])

  return {
    asfl: scan.asflFiles.filter((f) => !pairedAsfl.has(f)),
    aspec: scan.aspecFiles.filter((f) => !pairedAspec.has(f)),
    guispec: scan.guispecFiles.filter((f) => !pairedGui.has(f))
  }
}

export function useProjectScan(projectRoot: Ref<string | null>) {
  const scan = ref<ProjectScanPayload | null>(null)
  const loading = ref(false)

  async function refresh(): Promise<void> {
    if (!projectRoot.value || !window.studio?.scanProject) {
      scan.value = null
      return
    }
    loading.value = true
    try {
      scan.value = await window.studio.scanProject(projectRoot.value)
    } catch (err) {
      console.error('[studio] project scan failed:', err)
      scan.value = null
    } finally {
      loading.value = false
    }
  }

  watch(projectRoot, () => void refresh(), { immediate: true })

  const pairs = computed(() => scan.value?.pairs ?? [])
  const unpaired = computed(() => computeUnpaired(scan.value))
  const hasUnpaired = computed(
    () => unpaired.value.asfl.length + unpaired.value.aspec.length + unpaired.value.guispec.length > 0
  )

  return { scan, loading, pairs, unpaired, hasUnpaired, refresh }
}
