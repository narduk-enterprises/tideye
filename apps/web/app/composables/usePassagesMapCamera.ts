import type { PassageDto } from '~/types/passage'

export interface PassagesMapCameraApi {
  setRegion: (c: { lat: number; lng: number }, s?: { lat: number; lng: number }) => void
  /** Fit to overlays; optional zoom-out steps (~2× span each, ≈ one MapKit zoom level). */
  zoomToFit: (zoomOutLevels?: number) => void
}

/**
 * Central voyages-map camera: fits to the same GeoJSON AppMapKit renders via {@link zoomToFit}
 * after MapKit’s internal map exists (`map-ready` from AppMapKit).
 */
export function usePassagesMapCamera(opts: {
  mapRef: Ref<PassagesMapCameraApi | null>
  passages: () => PassageDto[]
  selectedId: Ref<string | null>
  mapkitReady: Ref<boolean>
  /** Re-run when overlay GeoJSON identity changes (tracks load, selection mode). */
  overlayKey: Ref<unknown> | ComputedRef<unknown>
}) {
  const mapEngineReady = ref(false)

  function applyPassagesMapCamera() {
    if (!opts.mapkitReady.value || !mapEngineReady.value) return
    const api = opts.mapRef.value
    if (!api) return
    const list = opts.passages()
    if (!list.length) return
    // Use AppMapKit’s bbox (all LineString vertices in props.geojson) so the fit matches
    // drawn tracks; one zoom-out step adds breathing room around the hull.
    api.zoomToFit(1)
  }

  async function schedulePassagesMapCamera() {
    await nextTick()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    applyPassagesMapCamera()
  }

  function onMapEngineReady() {
    mapEngineReady.value = true
    void schedulePassagesMapCamera()
  }

  watch(
    () =>
      [
        opts.mapkitReady.value,
        opts.selectedId.value,
        opts.passages().length,
        toValue(opts.overlayKey),
      ] as const,
    () => {
      void schedulePassagesMapCamera()
    },
    { immediate: true },
  )

  watch(
    () => opts.mapRef.value,
    (api) => {
      if (api && mapEngineReady.value && opts.mapkitReady.value) void schedulePassagesMapCamera()
    },
  )

  return {
    applyPassagesMapCamera,
    schedulePassagesMapCamera,
    onMapEngineReady,
    mapEngineReady: readonly(mapEngineReady),
  }
}
