import { useVesselPosition } from '~/composables/useVesselPosition'
import type { MapVesselItem } from '~/types/map'

/**
 * useMapVessels — provides self-vessel item for AppMapKit.
 *
 * AIS vessels are managed separately by useAISOverlay (direct MapKit
 * annotations) to avoid AppMapKit's items-watcher rebuild-all cycle.
 */
export function useMapVessels() {
  const { lat, lng, hasPosition, heading } = useVesselPosition()

  /** Self-vessel as a pin item for AppMapKit (1 DOM element) */
  const selfItems = computed<MapVesselItem[]>(() => {
    if (!hasPosition.value || lat.value === null || lng.value === null) return []
    return [
      {
        id: 'self',
        lat: lat.value,
        lng: lng.value,
        type: 'self',
        heading: heading.value,
      },
    ]
  })

  return { selfItems }
}
