<script setup lang="ts">
import type {
  PlaybackCameraMode,
  PlaybackEventMarker,
  PlaybackMapVessel,
} from '~/composables/usePassagePlayback'

// MapKit is a CDN global with no official TS types.
declare const mapkit: any

const props = withDefaults(
  defineProps<{
    routeCoordinates: Array<[number, number]>
    completedCoordinates: Array<[number, number]>
    wakeCoordinates: Array<[number, number]>
    selfVessel: PlaybackMapVessel | null
    trafficVessels: PlaybackMapVessel[]
    selectedTrafficId?: string | null
    cameraMode: PlaybackCameraMode
    currentEvent?: PlaybackEventMarker | null
  }>(),
  {
    selectedTrafficId: null,
    currentEvent: null,
  },
)

const emit = defineEmits<{
  'traffic-select': [id: string | null]
}>()

const FALLBACK_VIEWBOX = {
  width: 1000,
  height: 620,
  padding: 56,
}

const { mapkitReady, mapkitError } = useMapKit()
const colorMode = useColorMode() as { value: string }
const mapContainer = ref<HTMLElement | null>(null)

let map: any | null = null
let completedOverlay: any | null = null
let wakeOverlay: any | null = null
let selfAnnotation: any | null = null
let selfIconEl: HTMLElement | null = null
let selfLabelEl: HTMLElement | null = null
let lastCameraAt = 0
let isApplyingCameraRegion = false
let userZoomSpan: { lat: number; lng: number } | null = null
let suspendAutoCameraUntil = 0

const trafficAnnotations = new Map<string, any>()
const trafficIcons = new Map<string, HTMLElement>()
const trafficLabels = new Map<string, HTMLElement>()
const interactiveMapReady = ref(false)
const showFallbackChart = computed(() => mapkitError.value || !interactiveMapReady.value)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function projectPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceNm: number,
): [number, number] {
  const R = 3440.065
  const d = distanceNm / R
  const brng = (bearingDeg * Math.PI) / 180
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI]
}

function createCoordinateList(coords: Array<[number, number]>) {
  return coords.map(([lng, lat]) => new mapkit.Coordinate(lat, lng))
}

function styleForColor(color: string, lineWidth: number, opacity = 1, dash: number[] = []) {
  return new mapkit.Style({
    strokeColor: color,
    strokeOpacity: opacity,
    fillColor: color,
    fillOpacity: 0,
    lineWidth,
    lineDash: dash,
  })
}

function vesselColor(vessel: PlaybackMapVessel, selected = false) {
  if (vessel.kind === 'self') return selected ? '#38bdf8' : '#0ea5e9'
  if ((vessel.lengthM ?? 0) >= 160) return selected ? '#ef4444' : '#b91c1c'
  if (vessel.shipTypeName && /cargo|freight/i.test(vessel.shipTypeName)) return '#65a30d'
  if (vessel.shipTypeName && /passenger|ferry/i.test(vessel.shipTypeName)) return '#0284c7'
  if (vessel.shipTypeName && /tanker/i.test(vessel.shipTypeName)) return '#dc2626'
  return selected ? '#f59e0b' : '#64748b'
}

function iconForEvent(kind: PlaybackEventMarker['kind']) {
  if (kind === 'departure') return 'i-lucide-anchor'
  if (kind === 'arrival') return 'i-lucide-flag'
  if (kind === 'peak-speed') return 'i-lucide-gauge'
  if (kind === 'course-change') return 'i-lucide-navigation'
  if (kind === 'overnight') return 'i-lucide-moon-star'
  return 'i-lucide-ship'
}

function buildMarkerShell(options: {
  vessel: PlaybackMapVessel
  selected: boolean
  showLabel: boolean
}) {
  const color = vesselColor(options.vessel, options.selected)
  const root = document.createElement('div')
  root.style.cssText = [
    'position:relative',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'touch-action:manipulation',
    'cursor:pointer',
    options.vessel.kind === 'self' ? 'width:38px;height:38px' : 'width:28px;height:28px',
  ].join(';')

  const glow = document.createElement('div')
  glow.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:999px',
    `background:${options.selected ? 'rgba(250,204,21,0.18)' : 'rgba(14,165,233,0.12)'}`,
    `box-shadow:0 0 0 ${options.selected ? 2 : 1}px ${options.selected ? 'rgba(250,204,21,0.45)' : 'rgba(14,165,233,0.2)'}`,
    options.vessel.kind === 'self' ? '' : 'transform:scale(0.82)',
  ].join(';')

  const icon = document.createElement('div')
  icon.style.cssText = [
    'position:relative',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'transition:transform 160ms linear',
    options.vessel.kind === 'self' ? 'width:24px;height:24px' : 'width:18px;height:18px',
  ].join(';')

  const width = options.vessel.kind === 'self' ? 22 : 18
  const height = options.vessel.kind === 'self' ? 24 : 20

  icon.innerHTML = `
    <svg viewBox="0 0 32 32" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ship-${options.vessel.id}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="1" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.76" />
        </linearGradient>
      </defs>
      <path d="M16 3 L23 24 Q23 29 16 29 Q9 29 9 24 Z" fill="url(#ship-${options.vessel.id})" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M16 8 L18.5 17 L16 20 L13.5 17 Z" fill="rgba(255,255,255,0.42)" />
    </svg>
  `

  root.appendChild(glow)
  root.appendChild(icon)

  let label: HTMLElement | null = null
  if (options.showLabel && options.vessel.label) {
    label = document.createElement('div')
    label.textContent = options.vessel.label
    label.style.cssText = [
      'position:absolute',
      'top:100%',
      'left:50%',
      'transform:translateX(-50%)',
      'margin-top:4px',
      'padding:2px 6px',
      'border-radius:999px',
      'white-space:nowrap',
      'font-size:10px',
      'font-weight:700',
      'letter-spacing:0.01em',
      'color:#f8fafc',
      'background:rgba(15,23,42,0.82)',
      'backdrop-filter:blur(10px)',
      'box-shadow:0 6px 24px rgba(15,23,42,0.2)',
      'pointer-events:none',
      'max-width:132px',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';')
    root.appendChild(label)
  }

  updateMarkerVisual(icon, label, options.vessel, options.selected)
  return { root, icon, label }
}

function updateMarkerVisual(
  icon: HTMLElement,
  label: HTMLElement | null,
  vessel: PlaybackMapVessel,
  selected: boolean,
) {
  const heading = vessel.heading ?? 0
  icon.style.transform = `rotate(${heading}deg) scale(${selected ? 1.08 : 1})`
  if (label) {
    label.style.background = selected ? 'rgba(15,23,42,0.94)' : 'rgba(15,23,42,0.82)'
  }
}

function clearOverlays() {
  if (!map) return
  for (const overlay of [completedOverlay, wakeOverlay]) {
    if (overlay) map.removeOverlay(overlay)
  }
  completedOverlay = null
  wakeOverlay = null
}

function rebuildRouteOverlays() {
  if (!map) return

  for (const overlay of [completedOverlay, wakeOverlay]) {
    if (overlay) map.removeOverlay(overlay)
  }

  completedOverlay = null
  wakeOverlay = null

  if (props.completedCoordinates.length >= 2) {
    completedOverlay = new mapkit.PolylineOverlay(
      createCoordinateList(props.completedCoordinates),
      {
        style: styleForColor('#0ea5e9', 4, 0.98),
      },
    )
    map.addOverlay(completedOverlay)
  }

  if (props.wakeCoordinates.length >= 2) {
    wakeOverlay = new mapkit.PolylineOverlay(createCoordinateList(props.wakeCoordinates), {
      style: styleForColor('#f8fafc', 2, 0.55),
    })
    map.addOverlay(wakeOverlay)
  }
}

function clearSelfAnnotation() {
  if (!map || !selfAnnotation) return
  map.removeAnnotation(selfAnnotation)
  selfAnnotation = null
  selfIconEl = null
  selfLabelEl = null
}

function syncSelfAnnotation() {
  if (!map) return
  const vessel = props.selfVessel
  if (!vessel) {
    clearSelfAnnotation()
    return
  }

  if (!selfAnnotation) {
    const shell = buildMarkerShell({
      vessel,
      selected: true,
      showLabel: true,
    })
    selfIconEl = shell.icon
    selfLabelEl = shell.label

    const root = shell.root
    root.addEventListener('click', (event) => {
      event.stopPropagation()
      emit('traffic-select', null)
    })

    selfAnnotation = new mapkit.Annotation(
      new mapkit.Coordinate(vessel.lat, vessel.lng),
      () => root,
      {
        anchorOffset: new DOMPoint(0, -6),
        calloutEnabled: false,
        animates: false,
        size: { width: 38, height: 38 },
      },
    )

    map.addAnnotation(selfAnnotation)
  } else {
    selfAnnotation.coordinate = new mapkit.Coordinate(vessel.lat, vessel.lng)
  }

  if (selfIconEl) {
    updateMarkerVisual(selfIconEl, selfLabelEl, vessel, true)
  }
}

function syncTrafficAnnotations() {
  if (!map) return

  const activeIds = new Set(props.trafficVessels.map((vessel) => vessel.id))

  for (const [id, annotation] of trafficAnnotations) {
    if (activeIds.has(id)) continue
    map.removeAnnotation(annotation)
    trafficAnnotations.delete(id)
    trafficIcons.delete(id)
    trafficLabels.delete(id)
  }

  for (const vessel of props.trafficVessels) {
    const selected = props.selectedTrafficId === vessel.id
    const existing = trafficAnnotations.get(vessel.id)

    if (!existing) {
      const shell = buildMarkerShell({
        vessel,
        selected,
        showLabel: selected || props.trafficVessels.length <= 10,
      })
      trafficIcons.set(vessel.id, shell.icon)
      if (shell.label) trafficLabels.set(vessel.id, shell.label)

      const root = shell.root
      root.title = vessel.label || vessel.mmsi || 'Traffic vessel'
      root.addEventListener('click', (event) => {
        event.stopPropagation()
        emit('traffic-select', vessel.id)
      })

      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(vessel.lat, vessel.lng),
        () => root,
        {
          anchorOffset: new DOMPoint(0, -4),
          calloutEnabled: false,
          animates: false,
          size: { width: 28, height: 28 },
          data: { vesselId: vessel.id },
        },
      )

      map.addAnnotation(annotation)
      trafficAnnotations.set(vessel.id, annotation)
    } else {
      existing.coordinate = new mapkit.Coordinate(vessel.lat, vessel.lng)
      updateMarkerVisual(
        trafficIcons.get(vessel.id)!,
        trafficLabels.get(vessel.id) ?? null,
        vessel,
        selected,
      )
    }
  }
}

function fitRoute(animated = true) {
  if (!map || !props.routeCoordinates.length) return

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const [lng, lat] of props.routeCoordinates) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  const center = new mapkit.Coordinate((minLat + maxLat) / 2, (minLng + maxLng) / 2)
  const span = new mapkit.CoordinateSpan(
    Math.max(0.02, (maxLat - minLat) * 1.2),
    Math.max(0.025, (maxLng - minLng) * 1.2),
  )

  map.setRegionAnimated(new mapkit.CoordinateRegion(center, span), animated)
}

function syncCamera() {
  if (!map || props.cameraMode === 'fit' || !props.selfVessel) return

  const now = Date.now()
  if (now < suspendAutoCameraUntil) return
  if (now - lastCameraAt < 260) return
  lastCameraAt = now

  const vessel = props.selfVessel
  const heading = vessel.heading ?? 0
  const autoSpanLat = clamp(0.045 + (vessel.sog ?? 0) * 0.004, 0.045, 0.16)
  const autoSpanLng = clamp(autoSpanLat * 1.24, 0.06, 0.22)
  const spanLat = Math.max(autoSpanLat, userZoomSpan?.lat ?? 0)
  const spanLng = Math.max(autoSpanLng, userZoomSpan?.lng ?? 0)

  let centerLat = vessel.lat
  let centerLng = vessel.lng

  if (props.cameraMode === 'lead') {
    const leadDistanceNm = clamp((vessel.sog ?? 4) * 0.18, 0.5, 2.4)
    const [lat, lng] = projectPoint(vessel.lat, vessel.lng, heading, leadDistanceNm)
    centerLat = lat
    centerLng = lng
  }

  isApplyingCameraRegion = true
  map.setRegionAnimated(
    new mapkit.CoordinateRegion(
      new mapkit.Coordinate(centerLat, centerLng),
      new mapkit.CoordinateSpan(spanLat, spanLng),
    ),
    true,
  )
}

function initMap() {
  if (!mapkitReady.value || map || !mapContainer.value) return

  map = new mapkit.Map(mapContainer.value, {
    isScrollEnabled: true,
    isZoomEnabled: true,
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Adaptive,
    colorScheme:
      colorMode.value === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light,
    mapType: mapkit.Map.MapTypes.Standard,
  })

  rebuildRouteOverlays()
  syncSelfAnnotation()
  syncTrafficAnnotations()

  const holdManualCamera = () => {
    if (props.cameraMode === 'fit') return
    suspendAutoCameraUntil = Date.now() + 1800
  }

  map.element.addEventListener('wheel', holdManualCamera, { passive: true })
  map.element.addEventListener('pointerdown', holdManualCamera, { passive: true })
  map.element.addEventListener('touchstart', holdManualCamera, { passive: true })

  map.addEventListener('region-change-end', () => {
    const region = map?.region
    if (!region) return

    if (isApplyingCameraRegion) {
      isApplyingCameraRegion = false
      return
    }

    if (props.cameraMode === 'fit') {
      userZoomSpan = null
      return
    }

    suspendAutoCameraUntil = Date.now() + 1800
    userZoomSpan = {
      lat: region.span.latitudeDelta,
      lng: region.span.longitudeDelta,
    }
  })
  if (props.cameraMode === 'fit') {
    fitRoute(false)
  } else {
    syncCamera()
  }
  interactiveMapReady.value = true
}

const fallbackBounds = computed(() => {
  const coords: Array<[number, number]> = [...props.routeCoordinates]

  if (props.selfVessel) {
    coords.push([props.selfVessel.lng, props.selfVessel.lat])
  }

  for (const vessel of props.trafficVessels) {
    coords.push([vessel.lng, vessel.lat])
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
    minLng: minLng - lngSpan * 0.08,
    maxLng: maxLng + lngSpan * 0.08,
    minLat: minLat - latSpan * 0.08,
    maxLat: maxLat + latSpan * 0.08,
    lngSpan: lngSpan * 1.16,
    latSpan: latSpan * 1.16,
  }
})

function projectToFallback(lat: number, lng: number) {
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

function buildFallbackPath(coords: Array<[number, number]>) {
  if (coords.length < 2) return ''
  return coords
    .map(([lng, lat], index) => {
      const point = projectToFallback(lat, lng)
      if (!point) return ''
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })
    .filter(Boolean)
    .join(' ')
}

const fallbackCompletedPath = computed(() => buildFallbackPath(props.completedCoordinates))
const fallbackWakePath = computed(() => buildFallbackPath(props.wakeCoordinates))

const fallbackSelfPoint = computed(() => {
  if (!props.selfVessel) return null
  const point = projectToFallback(props.selfVessel.lat, props.selfVessel.lng)
  if (!point) return null
  return { ...point, vessel: props.selfVessel }
})

const fallbackTrafficPoints = computed(() =>
  props.trafficVessels
    .slice(0, 28)
    .map((vessel) => {
      const point = projectToFallback(vessel.lat, vessel.lng)
      return point ? { ...point, vessel } : null
    })
    .filter((point): point is { x: number; y: number; vessel: PlaybackMapVessel } =>
      Boolean(point),
    ),
)

const fallbackStartPoint = computed(() => {
  const first = props.routeCoordinates[0]
  if (!first) return null
  return projectToFallback(first[1], first[0])
})

const fallbackEndPoint = computed(() => {
  const last = props.routeCoordinates.at(-1)
  if (!last) return null
  return projectToFallback(last[1], last[0])
})

watch(mapkitReady, (ready) => {
  if (ready) nextTick(initMap)
})

watch(
  () => colorMode.value,
  (mode) => {
    if (!map) return
    map.colorScheme = mode === 'dark' ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light
    rebuildRouteOverlays()
  },
)

watch(
  () => props.routeCoordinates,
  () => {
    if (!map) return
    rebuildRouteOverlays()
    if (props.cameraMode === 'fit') fitRoute()
  },
  { deep: false },
)

watch(
  () => [props.completedCoordinates, props.wakeCoordinates] as const,
  () => {
    if (!map) return
    rebuildRouteOverlays()
  },
  { deep: false },
)

watch(
  () => props.selfVessel,
  () => {
    syncSelfAnnotation()
    syncCamera()
  },
  { deep: false },
)

watch(
  () => [props.trafficVessels, props.selectedTrafficId] as const,
  () => {
    syncTrafficAnnotations()
  },
  { deep: false },
)

watch(
  () => props.cameraMode,
  (mode) => {
    if (!map) return
    if (mode === 'fit') {
      userZoomSpan = null
      fitRoute()
      return
    }
    userZoomSpan = null
    syncCamera()
  },
)

onMounted(() => {
  if (mapkitReady.value) initMap()
})

onBeforeUnmount(() => {
  clearOverlays()
  clearSelfAnnotation()
  if (map) {
    for (const annotation of trafficAnnotations.values()) {
      map.removeAnnotation(annotation)
    }
    trafficAnnotations.clear()
    trafficIcons.clear()
    trafficLabels.clear()
    map.destroy()
    map = null
  }
  interactiveMapReady.value = false
})
</script>

<template>
  <div
    class="relative isolate h-[56dvh] min-h-[30rem] overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(241,248,250,0.97),_rgba(226,238,242,0.95))] shadow-[0_18px_40px_rgba(148,163,184,0.14)] xl:h-[64dvh]"
  >
    <div
      class="absolute left-4 top-4 z-20 rounded-full border border-white/75 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur"
    >
      <div class="flex items-center gap-2 text-[11px]">
        <UIcon
          :name="
            mapkitError
              ? 'i-lucide-map-off'
              : interactiveMapReady
                ? 'i-lucide-route'
                : 'i-lucide-loader-circle'
          "
          class="size-4"
          :class="
            mapkitError
              ? 'text-amber-600'
              : interactiveMapReady
                ? 'text-sky-600'
                : 'animate-spin text-sky-600'
          "
        />
        <span class="font-semibold text-slate-800">
          {{ mapkitError ? 'Fallback chart' : !mapkitReady ? 'Preparing map' : 'Playback map' }}
        </span>
      </div>
    </div>

    <div
      v-if="props.currentEvent"
      class="absolute left-4 top-[3.9rem] z-20 max-w-[18rem] rounded-[1.1rem] border border-white/75 bg-white/84 px-3 py-2 shadow-sm backdrop-blur"
    >
      <div class="flex items-start gap-2">
        <span
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700"
        >
          <UIcon :name="iconForEvent(props.currentEvent.kind)" class="size-3.5" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
            Passage moment
          </p>
          <p class="mt-0.5 text-[13px] font-medium text-slate-900">
            {{ props.currentEvent.label }}
          </p>
        </div>
      </div>
    </div>

    <div
      ref="mapContainer"
      class="absolute inset-0 transition-opacity duration-500"
      :class="interactiveMapReady && !mapkitError ? 'opacity-100' : 'opacity-0'"
    />

    <svg
      v-if="showFallbackChart"
      class="pointer-events-none absolute inset-0 h-full w-full"
      :viewBox="`0 0 ${FALLBACK_VIEWBOX.width} ${FALLBACK_VIEWBOX.height}`"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="playback-route" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f766e" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#475569" stop-opacity="0.18" />
        </linearGradient>
        <linearGradient id="playback-progress" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#14b8a6" />
          <stop offset="100%" stop-color="#0ea5e9" />
        </linearGradient>
        <pattern id="playback-grid" width="72" height="72" patternUnits="userSpaceOnUse">
          <path
            d="M 72 0 L 0 0 0 72"
            fill="none"
            stroke="rgba(148,163,184,0.18)"
            stroke-width="1"
          />
        </pattern>
      </defs>

      <rect
        x="0"
        y="0"
        :width="FALLBACK_VIEWBOX.width"
        :height="FALLBACK_VIEWBOX.height"
        fill="url(#playback-grid)"
      />

      <path
        v-if="fallbackCompletedPath"
        :d="fallbackCompletedPath"
        fill="none"
        stroke="url(#playback-progress)"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="6"
      />
      <path
        v-if="fallbackWakePath"
        :d="fallbackWakePath"
        fill="none"
        stroke="#ffffff"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-opacity="0.9"
        stroke-width="2.5"
      />

      <g v-if="fallbackStartPoint">
        <circle :cx="fallbackStartPoint.x" :cy="fallbackStartPoint.y" r="7" fill="#0f766e" />
        <circle
          :cx="fallbackStartPoint.x"
          :cy="fallbackStartPoint.y"
          r="13"
          fill="none"
          stroke="#0f766e"
          stroke-opacity="0.25"
          stroke-width="3"
        />
      </g>

      <g v-if="fallbackEndPoint">
        <circle :cx="fallbackEndPoint.x" :cy="fallbackEndPoint.y" r="7" fill="#f97316" />
        <circle
          :cx="fallbackEndPoint.x"
          :cy="fallbackEndPoint.y"
          r="13"
          fill="none"
          stroke="#f97316"
          stroke-opacity="0.22"
          stroke-width="3"
        />
      </g>

      <g v-for="traffic in fallbackTrafficPoints" :key="traffic.vessel.id">
        <circle
          :cx="traffic.x"
          :cy="traffic.y"
          :r="props.selectedTrafficId === traffic.vessel.id ? 7.5 : 5.5"
          :fill="vesselColor(traffic.vessel, props.selectedTrafficId === traffic.vessel.id)"
          fill-opacity="0.82"
          stroke="rgba(255,255,255,0.92)"
          stroke-width="1.5"
        />
      </g>

      <g v-if="fallbackSelfPoint">
        <circle
          :cx="fallbackSelfPoint.x"
          :cy="fallbackSelfPoint.y"
          r="13"
          fill="#0ea5e9"
          fill-opacity="0.18"
        />
        <circle
          :cx="fallbackSelfPoint.x"
          :cy="fallbackSelfPoint.y"
          r="7.5"
          fill="#0284c7"
          stroke="#ffffff"
          stroke-width="2"
        />
      </g>
    </svg>

    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-white/40 to-transparent"
    />
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-white/50 to-transparent"
    />
  </div>
</template>
