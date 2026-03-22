<script setup lang="ts">
import type { PassageDto } from '~/types/passage'

/** Structural match for AppMapKit `geojson` (LineString voyage track). */
interface VoyageTrackFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: { type: string; coordinates: unknown }
  }>
}

const props = withDefaults(
  defineProps<{
    passages: PassageDto[]
    /** AIS / traffic snapshot markers (MapKit circles). */
    trafficCircles?: Array<{
      lat: number
      lng: number
      radius: number
      color: string
      opacity?: number
    }>
  }>(),
  { trafficCircles: () => [] },
)

const selectedId = defineModel<string | null>('selectedId', { default: null })

const { mapkitReady } = useMapKit()

const mapRef = ref<{
  setRegion: (c: { lat: number; lng: number }, s?: { lat: number; lng: number }) => void
  zoomToFit: (zoomOutLevels?: number) => void
} | null>(null)

function rawTrackToFeatureCollection(
  raw: string,
  passageId: string,
): VoyageTrackFeatureCollection | null {
  try {
    const o = JSON.parse(raw) as { type?: string; features?: unknown[]; coordinates?: unknown }
    if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
      const fc = o as VoyageTrackFeatureCollection
      for (const f of fc.features) {
        if (!f.properties) f.properties = {}
        f.properties.passageId = passageId
      }
      return fc
    }
    if (o.type === 'LineString' && Array.isArray(o.coordinates)) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { passageId: passageId },
            geometry: { type: 'LineString', coordinates: o.coordinates },
          },
        ],
      }
    }
  } catch {
    return null
  }
  return null
}

/** One passage’s stored track GeoJSON, or null. */
function passageToTrackFeatureCollection(
  p: PassageDto | undefined,
): VoyageTrackFeatureCollection | null {
  const raw = p?.trackGeojson
  if (!raw) return null
  return rawTrackToFeatureCollection(raw, p.id)
}

/** Every voyage with a track polyline, or a start→end segment if no track — for overview map. */
function allPassagesTracksFeatureCollection(
  passages: PassageDto[],
): VoyageTrackFeatureCollection | null {
  const features: VoyageTrackFeatureCollection['features'] = []
  for (const p of passages) {
    const raw = p.trackGeojson
    if (raw) {
      const fc = rawTrackToFeatureCollection(raw, p.id)
      if (fc?.features?.length) {
        features.push(...fc.features)
        continue
      }
    }
    const a = p.startLat
    const b = p.endLat
    const c = p.startLon
    const d = p.endLon
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d)) {
      features.push({
        type: 'Feature',
        properties: { passageId: p.id, kind: 'endpoints' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [c, a],
            [d, b],
          ],
        },
      })
    }
  }
  if (!features.length) return null
  return { type: 'FeatureCollection', features }
}

const trackOverlayGeojson = computed((): VoyageTrackFeatureCollection | null => {
  const id = selectedId.value
  if (id) {
    const p = props.passages.find((x) => x.id === id)
    return passageToTrackFeatureCollection(p)
  }
  return allPassagesTracksFeatureCollection(props.passages)
})

const mapCameraOverlayKey = computed(() => ({
  geo: trackOverlayGeojson.value,
  trafficLen: props.trafficCircles?.length ?? 0,
}))

const { onMapEngineReady } = usePassagesMapCamera({
  mapRef,
  passages: () => props.passages,
  selectedId,
  mapkitReady,
  overlayKey: mapCameraOverlayKey,
})

function voyageTrackOverlayStyle() {
  return {
    // eslint-disable-next-line narduk/no-inline-hex -- MapKit Style API requires raw hex
    strokeColor: '#0284c7',
    strokeOpacity: 0.95,
    // eslint-disable-next-line narduk/no-inline-hex -- MapKit Style API requires raw hex
    fillColor: '#000000',
    fillOpacity: 0,
    lineWidth: 3,
  }
}

const fallbackCenter = computed(() => {
  if (!props.passages.length) return { lat: 18.2, lng: -65.8 }
  const p = props.passages[0]!
  return {
    lat: (p.startLat + p.endLat) / 2,
    lng: (p.startLon + p.endLon) / 2,
  }
})
</script>

<template>
  <AppMapKit
    ref="mapRef"
    class="passages-explorer-map h-full min-h-[min(52vh,420px)] w-full overflow-hidden rounded-xl border border-default md:min-h-0 md:rounded-xl"
    :fallback-center="fallbackCenter"
    :geojson="trackOverlayGeojson"
    :overlay-style-fn="voyageTrackOverlayStyle"
    v-model:selected-id="selectedId"
    :preserve-region="true"
    :suppress-selection-zoom="true"
    :bounding-padding="0.08"
    :min-span-delta="0.25"
    :shows-points-of-interest="false"
    :circles="trafficCircles"
    @map-ready="onMapEngineReady"
  />
</template>
