/**
 * Persists and restores the map camera region to localStorage.
 * Extracted from pages/map/index.vue to keep the page thin.
 */

const REGION_STORAGE_KEY = 'tideye:map-region'

interface SavedRegion {
  centerLat: number
  centerLng: number
  latDelta: number
  lngDelta: number
}

export function useMapRegion() {
  function getSavedRegion(): SavedRegion | null {
    try {
      if (!import.meta.client) return null
      const raw = localStorage.getItem(REGION_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as SavedRegion) : null
    } catch {
      return null
    }
  }

  function saveRegion(region: SavedRegion) {
    try {
      if (!import.meta.client) return
      localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(region))
    } catch {
      /* quota exceeded — ignore */
    }
  }

  function onRegionChange(span: {
    latDelta: number
    lngDelta: number
    centerLat: number
    centerLng: number
  }) {
    saveRegion(span)
  }

  const savedRegion = import.meta.client ? getSavedRegion() : null

  return { savedRegion, getSavedRegion, saveRegion, onRegionChange }
}
