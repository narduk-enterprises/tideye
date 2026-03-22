<script setup lang="ts">
import type { PassagePlaybackGeojson } from '~/types/passagePlayback'

interface RouteMarker {
  id: string
  lat: number
  lng: number
  role: 'start' | 'end' | 'current'
}

const props = withDefaults(
  defineProps<{
    trackGeojsonRaw: string | null
    routeCoordinates: Array<[number, number]>
    startLat: number
    startLon: number
    endLat: number
    endLon: number
    currentLat?: number | null
    currentLon?: number | null
  }>(),
  {
    currentLat: null,
    currentLon: null,
  },
)

const emit = defineEmits<{
  'focus-route': []
}>()

const { mapkitError } = useMapKit()

const FALLBACK_VIEWBOX = {
  width: 600,
  height: 360,
  padding: 28,
}

function colorForRole(role: RouteMarker['role']) {
  if (role === 'start') return '#0f766e'
  if (role === 'end') return '#f97316'
  return '#0284c7'
}

function markerSize(role: RouteMarker['role']) {
  if (role === 'current') return 18
  return 10
}

function createMarkerElement(marker: RouteMarker) {
  const root = document.createElement('div')
  root.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'height:100%',
    'pointer-events:none',
  ].join(';')

  const halo = document.createElement('div')
  const outerPx = markerSize(marker.role)
  halo.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `width:${outerPx}px`,
    `height:${outerPx}px`,
    'border-radius:999px',
    `background:${marker.role === 'current' ? 'rgba(14,165,233,0.18)' : 'rgba(255,255,255,0.92)'}`,
    marker.role === 'current'
      ? 'box-shadow:0 0 0 5px rgba(14,165,233,0.16)'
      : 'box-shadow:0 0 0 2px rgba(255,255,255,0.92)',
  ].join(';')

  const dot = document.createElement('div')
  dot.style.cssText = [
    `width:${marker.role === 'current' ? 10 : 6}px`,
    `height:${marker.role === 'current' ? 10 : 6}px`,
    'border-radius:999px',
    `background:${colorForRole(marker.role)}`,
  ].join(';')

  halo.appendChild(dot)
  root.appendChild(halo)
  return { element: root }
}

function rawTrackToFeatureCollection(raw: string): PassagePlaybackGeojson | null {
  try {
    const parsed = JSON.parse(raw) as { type?: string; features?: unknown[]; coordinates?: unknown }
    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed as PassagePlaybackGeojson
    }
    if (parsed.type === 'LineString' && Array.isArray(parsed.coordinates)) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: parsed.coordinates,
            },
          },
        ],
      }
    }
  } catch {
    return null
  }
  return null
}

const routeGeojson = computed<PassagePlaybackGeojson | null>(() => {
  const parsed = props.trackGeojsonRaw ? rawTrackToFeatureCollection(props.trackGeojsonRaw) : null
  if (parsed?.features?.length) return parsed
  if (props.routeCoordinates.length < 2) return null
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: props.routeCoordinates,
        },
      },
    ],
  }
})

const markerItems = computed<RouteMarker[]>(() => {
  const items: RouteMarker[] = [
    { id: 'start', role: 'start', lat: props.startLat, lng: props.startLon },
    { id: 'end', role: 'end', lat: props.endLat, lng: props.endLon },
  ]

  if (props.currentLat != null && props.currentLon != null) {
    items.push({
      id: 'current',
      role: 'current',
      lat: props.currentLat,
      lng: props.currentLon,
    })
  }

  return items
})

const fallbackCoordinates = computed(() => {
  if (props.routeCoordinates.length >= 2) return props.routeCoordinates
  return [
    [props.startLon, props.startLat] as [number, number],
    [props.endLon, props.endLat] as [number, number],
  ]
})

const fallbackBounds = computed(() => {
  const coords = [...fallbackCoordinates.value]

  if (props.currentLat != null && props.currentLon != null) {
    coords.push([props.currentLon, props.currentLat])
  }

  if (!coords.length) return null

  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }

  const lngSpan = Math.max(0.08, maxLng - minLng)
  const latSpan = Math.max(0.08, maxLat - minLat)

  return {
    minLng: minLng - lngSpan * 0.12,
    maxLng: maxLng + lngSpan * 0.12,
    minLat: minLat - latSpan * 0.12,
    maxLat: maxLat + latSpan * 0.12,
    lngSpan: lngSpan * 1.24,
    latSpan: latSpan * 1.24,
  }
})

function projectPoint(lat: number, lng: number) {
  const bounds = fallbackBounds.value
  if (!bounds) return null

  const width = FALLBACK_VIEWBOX.width - FALLBACK_VIEWBOX.padding * 2
  const height = FALLBACK_VIEWBOX.height - FALLBACK_VIEWBOX.padding * 2

  return {
    x:
      FALLBACK_VIEWBOX.padding + ((lng - bounds.minLng) / Math.max(bounds.lngSpan, 0.0001)) * width,
    y:
      FALLBACK_VIEWBOX.height -
      FALLBACK_VIEWBOX.padding -
      ((lat - bounds.minLat) / Math.max(bounds.latSpan, 0.0001)) * height,
  }
}

const fallbackPath = computed(() => {
  if (fallbackCoordinates.value.length < 2) return ''
  return fallbackCoordinates.value
    .map(([lng, lat], index) => {
      const point = projectPoint(lat, lng)
      if (!point) return ''
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    .filter(Boolean)
    .join(' ')
})

const fallbackStart = computed(() => projectPoint(props.startLat, props.startLon))
const fallbackEnd = computed(() => projectPoint(props.endLat, props.endLon))
const fallbackCurrent = computed(() =>
  props.currentLat != null && props.currentLon != null
    ? projectPoint(props.currentLat, props.currentLon)
    : null,
)

function routeOverlayStyle() {
  return {
    strokeColor: '#0284c7',
    strokeOpacity: 0.95,
    fillColor: '#000000',
    fillOpacity: 0,
    lineWidth: 3,
  }
}

const fallbackCenter = computed(() => ({
  lat: (props.startLat + props.endLat) / 2,
  lng: (props.startLon + props.endLon) / 2,
}))
</script>

<template>
  <div
    class="overflow-hidden rounded-[1.1rem] border border-white/82 bg-white/84 shadow-[0_14px_32px_rgba(15,23,42,0.12)] backdrop-blur"
  >
    <div class="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-2">
      <div class="min-w-0">
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
          Route context
        </p>
        <p class="text-[11px] text-slate-600">Full passage with current playback position</p>
      </div>

      <UButton size="xs" variant="ghost" color="neutral" @click="emit('focus-route')">
        Fit
      </UButton>
    </div>

    <div
      class="relative h-44 w-full bg-[linear-gradient(180deg,rgba(244,251,252,0.95),rgba(234,244,247,0.96))]"
    >
      <AppMapKit
        v-if="!mapkitError"
        class="pointer-events-none h-full w-full"
        :geojson="routeGeojson"
        :items="markerItems"
        :create-pin-element="createMarkerElement"
        :annotation-size="{ width: 24, height: 24 }"
        :overlay-style-fn="routeOverlayStyle"
        :fallback-center="fallbackCenter"
        :bounding-padding="0.12"
        :min-span-delta="0.18"
        :preserve-region="false"
        :is-scroll-enabled="false"
        :is-zoom-enabled="false"
        :is-rotation-enabled="false"
        :shows-points-of-interest="false"
      />

      <svg
        v-else
        class="absolute inset-0 h-full w-full"
        :viewBox="`0 0 ${FALLBACK_VIEWBOX.width} ${FALLBACK_VIEWBOX.height}`"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="route-overview-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0f766e" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
        </defs>

        <rect
          x="0"
          y="0"
          :width="FALLBACK_VIEWBOX.width"
          :height="FALLBACK_VIEWBOX.height"
          fill="rgba(255,255,255,0.42)"
        />

        <path
          v-if="fallbackPath"
          :d="fallbackPath"
          fill="none"
          stroke="url(#route-overview-line)"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="5"
        />

        <g v-if="fallbackStart">
          <circle :cx="fallbackStart.x" :cy="fallbackStart.y" r="8" fill="#ffffff" />
          <circle :cx="fallbackStart.x" :cy="fallbackStart.y" r="4.5" fill="#0f766e" />
        </g>

        <g v-if="fallbackEnd">
          <circle :cx="fallbackEnd.x" :cy="fallbackEnd.y" r="8" fill="#ffffff" />
          <circle :cx="fallbackEnd.x" :cy="fallbackEnd.y" r="4.5" fill="#f97316" />
        </g>

        <g v-if="fallbackCurrent">
          <circle
            :cx="fallbackCurrent.x"
            :cy="fallbackCurrent.y"
            r="13"
            fill="rgba(14,165,233,0.18)"
          />
          <circle :cx="fallbackCurrent.x" :cy="fallbackCurrent.y" r="8" fill="#ffffff" />
          <circle :cx="fallbackCurrent.x" :cy="fallbackCurrent.y" r="5" fill="#0284c7" />
        </g>
      </svg>
    </div>
  </div>
</template>
