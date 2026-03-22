import { useVesselPosition } from '~/composables/useVesselPosition'
import { useSignalKData } from '~/composables/useSignalKData'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapkit is a CDN global with no published TypeScript types
declare const mapkit: any

const MAP_FEATURES_KEY = 'tideye:map-features'

// ── Geo Helpers (shared) ─────────────────────────────────────

function projectPointFromLatLng(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceNM: number,
): [number, number] {
  const R = 3440.065
  const d = distanceNM / R
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

function haversineNM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1852
}

function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function cardinalLabel(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  return dirs[Math.round(deg / 22.5) % 16] ?? ''
}

// ── Persistence ──────────────────────────────────────────────

interface MapFeaturesPrefs {
  rangeRings: boolean
  headingLine: boolean
  selfTrail: boolean
  anchorLat: number | null
  anchorLng: number | null
  anchorRadius: number // NM
  anchorActive: boolean
  mapType: string // 'standard' | 'satellite' | 'hybrid'
  waypoints: Array<{ id: string; name: string; lat: number; lng: number }>
}

const DEFAULT_FEATURES: MapFeaturesPrefs = {
  rangeRings: false,
  headingLine: false,
  selfTrail: false,
  anchorLat: null,
  anchorLng: null,
  anchorRadius: 0.05, // 0.05 NM ≈ 300 ft
  anchorActive: false,
  mapType: 'standard',
  waypoints: [],
}

function loadFeaturePrefs(): MapFeaturesPrefs {
  try {
    if (!import.meta.client) return { ...DEFAULT_FEATURES }
    const raw = localStorage.getItem(MAP_FEATURES_KEY)
    if (!raw) return { ...DEFAULT_FEATURES }
    return { ...DEFAULT_FEATURES, ...JSON.parse(raw) } as MapFeaturesPrefs
  } catch {
    return { ...DEFAULT_FEATURES }
  }
}

function saveFeaturePrefs(prefs: MapFeaturesPrefs) {
  try {
    if (import.meta.client) localStorage.setItem(MAP_FEATURES_KEY, JSON.stringify(prefs))
  } catch {
    /* quota exceeded */
  }
}

// ── MapKit Helpers ───────────────────────────────────────────

interface MapRef {
  setCenterAnimated(coord: unknown, animated: boolean): void
  addOverlay(overlay: unknown): void
  removeOverlay(overlay: unknown): void
  addAnnotation(ann: unknown): void
  removeAnnotation(ann: unknown): void
  overlays?: unknown[]
  annotations?: unknown[]
  region?: {
    span: { latitudeDelta: number; longitudeDelta: number }
    center: { latitude: number; longitude: number }
  }
  mapType?: unknown
}

function getMap(): MapRef | null {
  try {
    return (mapkit?.maps?.[0] ?? null) as MapRef | null
  } catch {
    return null
  }
}

/**
 * useMapFeatures — bundles Range Rings, Heading/COG Line, Self Trail,
 * Anchor Watch, Waypoints, Distance Measurement, and Map Type switching.
 */
export function useMapFeatures() {
  const { lat, lng, heading, cog, sog } = useVesselPosition()
  const { getDepthData, getWaterTempData, getWindData, getCurrentData } = useSignalKData()

  const depth = getDepthData()
  const waterTemp = getWaterTempData()
  const wind = getWindData()
  const current = getCurrentData()

  // ── Feature Toggles ──
  const showRangeRings = ref(false)
  const showHeadingLine = ref(false)
  const showSelfTrail = ref(false)
  const mapType = ref<'standard' | 'satellite' | 'hybrid'>('standard')

  // ── Anchor Watch ──
  const anchorActive = ref(false)
  const anchorLat = ref<number | null>(null)
  const anchorLng = ref<number | null>(null)
  const anchorRadius = ref(0.05) // NM
  const anchorBreach = ref(false)

  // ── Waypoints ──
  const waypoints = ref<Array<{ id: string; name: string; lat: number; lng: number }>>([])

  // ── Distance Measurement ──
  const measureMode = ref(false)
  const measurePoints = ref<Array<{ lat: number; lng: number }>>([])
  const measureResult = computed(() => {
    if (measurePoints.value.length < 2) return null
    const [a, b] = measurePoints.value
    const dist = haversineNM(a!.lat, a!.lng, b!.lat, b!.lng)
    const brg = bearingTo(a!.lat, a!.lng, b!.lat, b!.lng)
    const etaMin = sog.value && sog.value > 0.3 ? (dist / sog.value) * 60 : null
    return {
      distNM: dist,
      bearing: brg,
      cardinal: cardinalLabel(brg),
      etaMinutes: etaMin,
    }
  })

  // ── Self Trail History ──
  const TRAIL_MAX = 360 // 30 min at 5s intervals
  const trailHistory = ref<Array<{ lat: number; lng: number; sog: number; ts: number }>>([])

  // ── Environmental Computed Values ──

  /** Depth below surface in feet, or null */
  const depthFt = computed(() => {
    const m =
      depth.value?.belowSurface?.value ??
      depth.value?.belowKeel?.value ??
      depth.value?.belowTransducer?.value
    return m != null ? m * 3.28084 : null
  })

  /** Depth severity: 'danger' < 10ft, 'warning' < 30ft, 'ok' >= 30ft */
  const depthSeverity = computed(() => {
    if (depthFt.value == null) return null
    if (depthFt.value < 10) return 'danger'
    if (depthFt.value < 30) return 'warning'
    return 'ok'
  })

  /** Water temp in °F, or null */
  const waterTempF = computed(() => {
    const k = waterTemp.value?.value
    return k != null ? (k - 273.15) * 1.8 + 32 : null
  })

  /** Wind speed apparent in knots, or null */
  const windSpeedKts = computed(() => {
    const ms = wind.value?.speedApparent?.value
    return ms != null ? ms * 1.94384 : null
  })

  /** Wind angle apparent in degrees, or null */
  const windAngleDeg = computed(() => {
    const rad = wind.value?.angleApparent?.value
    return rad != null ? (rad * 180) / Math.PI : null
  })

  /** Current set (direction) in degrees, or null */
  const currentSetDeg = computed(() => {
    const rad = current.value?.drift?.value
    return rad != null ? (rad * 180) / Math.PI : null
  })

  /** Current drift speed in knots, or null */
  const currentDriftKts = computed(() => {
    const ms = current.value?.setTrue?.value
    return ms != null ? ms * 1.94384 : null
  })

  // ── Overlay Storage ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const rangeRingOverlays: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const headingLineOverlays: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  let selfTrailOverlay: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const anchorOverlays: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const waypointAnnotations: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const measureOverlays: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit overlay refs lack published TS types
  const measureAnnotations: any[] = []

  let trailTimer: ReturnType<typeof setInterval> | null = null

  // ── Persistence ──

  function _savePrefs() {
    saveFeaturePrefs({
      rangeRings: showRangeRings.value,
      headingLine: showHeadingLine.value,
      selfTrail: showSelfTrail.value,
      anchorLat: anchorLat.value,
      anchorLng: anchorLng.value,
      anchorRadius: anchorRadius.value,
      anchorActive: anchorActive.value,
      mapType: mapType.value,
      waypoints: waypoints.value,
    })
  }

  // ── Range Rings ──

  const RANGE_RING_NM = [0.5, 1, 2, 5]

  function refreshRangeRings() {
    const map = getMap()
    if (!map) return
    for (const o of rangeRingOverlays) map.removeOverlay(o)
    rangeRingOverlays.length = 0

    if (!showRangeRings.value || lat.value == null || lng.value == null) return

    for (const radius of RANGE_RING_NM) {
      const pts = 64
      const coords = []
      for (let i = 0; i <= pts; i++) {
        const angle = (360 / pts) * i
        const [pLat, pLng] = projectPointFromLatLng(lat.value, lng.value, angle, radius)
        coords.push(new mapkit.Coordinate(pLat, pLng))
      }
      const overlay = new mapkit.PolylineOverlay(coords, {
        style: new mapkit.Style({
          lineWidth: 1,
          strokeColor: '#0891b2',
          strokeOpacity: 0.35,
          lineDash: [4, 6],
        }),
      })
      map.addOverlay(overlay)
      rangeRingOverlays.push(overlay)
    }
  }

  // ── Heading / COG Lines ──

  function refreshHeadingLines() {
    const map = getMap()
    if (!map) return
    for (const o of headingLineOverlays) map.removeOverlay(o)
    headingLineOverlays.length = 0

    if (!showHeadingLine.value || lat.value == null || lng.value == null) return

    const speed = sog.value ?? 0
    const lineDistNM = Math.max(speed * 0.5, 0.5) // at least 0.5 NM

    // Heading line (solid)
    if (heading.value != null) {
      const [eLat, eLng] = projectPointFromLatLng(lat.value, lng.value, heading.value, lineDistNM)
      const overlay = new mapkit.PolylineOverlay(
        [new mapkit.Coordinate(lat.value, lng.value), new mapkit.Coordinate(eLat, eLng)],
        {
          style: new mapkit.Style({
            lineWidth: 2,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.7,
          }),
        },
      )
      map.addOverlay(overlay)
      headingLineOverlays.push(overlay)
    }

    // COG line (dashed) — only if different from heading
    if (cog.value != null && heading.value != null && Math.abs(cog.value - heading.value) > 3) {
      const [eLat, eLng] = projectPointFromLatLng(lat.value, lng.value, cog.value, lineDistNM)
      const overlay = new mapkit.PolylineOverlay(
        [new mapkit.Coordinate(lat.value, lng.value), new mapkit.Coordinate(eLat, eLng)],
        {
          style: new mapkit.Style({
            lineWidth: 2,
            lineDash: [6, 4],
            strokeColor: '#ef4444',
            strokeOpacity: 0.6,
          }),
        },
      )
      map.addOverlay(overlay)
      headingLineOverlays.push(overlay)
    }
  }

  // ── Self Trail ──

  function recordTrailPoint() {
    if (lat.value == null || lng.value == null) return
    trailHistory.value.push({
      lat: lat.value,
      lng: lng.value,
      sog: sog.value ?? 0,
      ts: Date.now(),
    })
    if (trailHistory.value.length > TRAIL_MAX) {
      trailHistory.value = trailHistory.value.slice(-TRAIL_MAX)
    }
  }

  function refreshSelfTrail() {
    const map = getMap()
    if (!map) return
    if (selfTrailOverlay) {
      map.removeOverlay(selfTrailOverlay)
      selfTrailOverlay = null
    }

    if (!showSelfTrail.value || trailHistory.value.length < 2) return

    const coords = trailHistory.value.map((p) => new mapkit.Coordinate(p.lat, p.lng))
    selfTrailOverlay = new mapkit.PolylineOverlay(coords, {
      style: new mapkit.Style({
        lineWidth: 3,
        strokeColor: '#8b5cf6',
        strokeOpacity: 0.6,
      }),
    })
    map.addOverlay(selfTrailOverlay)
  }

  // ── Anchor Watch ──

  function setAnchor() {
    if (lat.value == null || lng.value == null) return
    anchorLat.value = lat.value
    anchorLng.value = lng.value
    anchorActive.value = true
    anchorBreach.value = false
    _savePrefs()
    refreshAnchorOverlay()
  }

  function clearAnchor() {
    anchorActive.value = false
    anchorLat.value = null
    anchorLng.value = null
    anchorBreach.value = false
    _savePrefs()
    refreshAnchorOverlay()
  }

  function checkAnchorBreach() {
    if (!anchorActive.value || anchorLat.value == null || anchorLng.value == null) {
      anchorBreach.value = false
      return
    }
    if (lat.value == null || lng.value == null) return
    const dist = haversineNM(anchorLat.value, anchorLng.value, lat.value, lng.value)
    anchorBreach.value = dist > anchorRadius.value
  }

  function refreshAnchorOverlay() {
    const map = getMap()
    if (!map) return
    for (const o of anchorOverlays) map.removeOverlay(o)
    anchorOverlays.length = 0

    if (!anchorActive.value || anchorLat.value == null || anchorLng.value == null) return

    // Draw anchor radius circle
    const pts = 64
    const coords = []
    for (let i = 0; i <= pts; i++) {
      const angle = (360 / pts) * i
      const [pLat, pLng] = projectPointFromLatLng(
        anchorLat.value,
        anchorLng.value,
        angle,
        anchorRadius.value,
      )
      coords.push(new mapkit.Coordinate(pLat, pLng))
    }
    const color = anchorBreach.value ? '#ef4444' : '#16a34a'
    const overlay = new mapkit.PolylineOverlay(coords, {
      style: new mapkit.Style({
        lineWidth: 2,
        strokeColor: color,
        strokeOpacity: 0.7,
        lineDash: anchorBreach.value ? [8, 4] : [],
      }),
    })
    map.addOverlay(overlay)
    anchorOverlays.push(overlay)
  }

  // ── Waypoints ──

  function addWaypoint(wpLat: number, wpLng: number, name?: string) {
    const id = `wp-${Date.now()}`
    const wpName = name || `WP ${waypoints.value.length + 1}`
    waypoints.value.push({ id, name: wpName, lat: wpLat, lng: wpLng })
    _savePrefs()
    refreshWaypointAnnotations()
  }

  function removeWaypoint(id: string) {
    waypoints.value = waypoints.value.filter((w) => w.id !== id)
    _savePrefs()
    refreshWaypointAnnotations()
  }

  function refreshWaypointAnnotations() {
    const map = getMap()
    if (!map) return
    for (const a of waypointAnnotations) map.removeAnnotation(a)
    waypointAnnotations.length = 0

    for (const wp of waypoints.value) {
      const coord = new mapkit.Coordinate(wp.lat, wp.lng)

      let distLabel = ''
      if (lat.value != null && lng.value != null) {
        const d = haversineNM(lat.value, lng.value, wp.lat, wp.lng)
        const b = bearingTo(lat.value, lng.value, wp.lat, wp.lng)
        distLabel = `${d < 1 ? `${(d * 2025.372).toFixed(0)} yd` : `${d.toFixed(1)} NM`} • ${b.toFixed(0)}° ${cardinalLabel(b)}`
      }

      const ann = new mapkit.Annotation(
        coord,
        () => {
          const el = document.createElement('div')
          el.style.cssText =
            'cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px;'
          el.innerHTML = `
            <div style="width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
            <div style="font-family:-apple-system,sans-serif;font-size:9px;font-weight:600;color:#f59e0b;background:rgba(255,255,255,0.85);padding:1px 4px;border-radius:3px;white-space:nowrap;text-shadow:0 0 2px white;">
              ${wp.name}${distLabel ? ` • ${distLabel}` : ''}
            </div>
          `
          return el
        },
        {
          anchorOffset: new DOMPoint(0, -6),
          calloutEnabled: false,
          animates: false,
          size: { width: 16, height: 16 },
          data: { waypointId: wp.id },
        },
      )
      map.addAnnotation(ann)
      waypointAnnotations.push(ann)
    }
  }

  // ── Distance Measurement ──

  function toggleMeasureMode() {
    measureMode.value = !measureMode.value
    if (!measureMode.value) clearMeasure()
  }

  function addMeasurePoint(mLat: number, mLng: number) {
    if (!measureMode.value) return
    if (measurePoints.value.length >= 2) {
      measurePoints.value = []
      clearMeasureOverlays()
    }
    measurePoints.value.push({ lat: mLat, lng: mLng })
    if (measurePoints.value.length === 2) refreshMeasureOverlays()
  }

  function clearMeasure() {
    measurePoints.value = []
    clearMeasureOverlays()
  }

  function clearMeasureOverlays() {
    const map = getMap()
    if (!map) return
    for (const o of measureOverlays) map.removeOverlay(o)
    for (const a of measureAnnotations) map.removeAnnotation(a)
    measureOverlays.length = 0
    measureAnnotations.length = 0
  }

  function refreshMeasureOverlays() {
    const map = getMap()
    if (!map || measurePoints.value.length < 2) return
    clearMeasureOverlays()

    const [a, b] = measurePoints.value
    const line = new mapkit.PolylineOverlay(
      [new mapkit.Coordinate(a!.lat, a!.lng), new mapkit.Coordinate(b!.lat, b!.lng)],
      {
        style: new mapkit.Style({
          lineWidth: 2,
          strokeColor: '#ec4899',
          strokeOpacity: 0.85,
          lineDash: [8, 4],
        }),
      },
    )
    map.addOverlay(line)
    measureOverlays.push(line)
  }

  // ── Map Type Switching ──

  function setMapType(type: 'standard' | 'satellite' | 'hybrid') {
    mapType.value = type
    _savePrefs()
    const map = getMap()
    if (!map) return
    const types: Record<string, unknown> = {
      standard: mapkit.Map.MapTypes.Standard,
      satellite: mapkit.Map.MapTypes.Satellite,
      hybrid: mapkit.Map.MapTypes.Hybrid,
    }
    map.mapType = types[type]
  }

  // ── Refresh All (called periodically) ──

  function refreshAll() {
    refreshRangeRings()
    refreshHeadingLines()
    refreshSelfTrail()
    checkAnchorBreach()
    refreshAnchorOverlay()
  }

  // ── Lifecycle ──

  let refreshInterval: ReturnType<typeof setInterval> | null = null

  function start() {
    // Restore prefs
    const saved = loadFeaturePrefs()
    showRangeRings.value = saved.rangeRings
    showHeadingLine.value = saved.headingLine
    showSelfTrail.value = saved.selfTrail
    anchorLat.value = saved.anchorLat
    anchorLng.value = saved.anchorLng
    anchorRadius.value = saved.anchorRadius
    anchorActive.value = saved.anchorActive
    mapType.value = (saved.mapType as 'standard' | 'satellite' | 'hybrid') || 'standard'
    waypoints.value = saved.waypoints || []

    // Apply map type
    setMapType(mapType.value)

    // Initial refresh
    refreshWaypointAnnotations()
    refreshAll()

    // Self trail recording every 5s
    trailTimer = setInterval(() => {
      if (showSelfTrail.value) recordTrailPoint()
    }, 5_000)

    // Overlay refresh every 3s
    refreshInterval = setInterval(refreshAll, 3_000)
  }

  function stop() {
    if (trailTimer) {
      clearInterval(trailTimer)
      trailTimer = null
    }
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }

    const map = getMap()
    if (map) {
      for (const o of rangeRingOverlays) map.removeOverlay(o)
      for (const o of headingLineOverlays) map.removeOverlay(o)
      if (selfTrailOverlay) map.removeOverlay(selfTrailOverlay)
      for (const o of anchorOverlays) map.removeOverlay(o)
      for (const a of waypointAnnotations) map.removeAnnotation(a)
      for (const o of measureOverlays) map.removeOverlay(o)
      for (const a of measureAnnotations) map.removeAnnotation(a)
    }
    rangeRingOverlays.length = 0
    headingLineOverlays.length = 0
    selfTrailOverlay = null
    anchorOverlays.length = 0
    waypointAnnotations.length = 0
    measureOverlays.length = 0
    measureAnnotations.length = 0
  }

  // React to toggle changes
  watch(showRangeRings, () => {
    _savePrefs()
    refreshRangeRings()
  })
  watch(showHeadingLine, () => {
    _savePrefs()
    refreshHeadingLines()
  })
  watch(showSelfTrail, () => {
    _savePrefs()
    if (!showSelfTrail.value) trailHistory.value = []
    refreshSelfTrail()
  })

  return {
    // Toggles
    showRangeRings,
    showHeadingLine,
    showSelfTrail,

    // Anchor watch
    anchorActive,
    anchorBreach,
    anchorRadius,
    setAnchor,
    clearAnchor,

    // Waypoints
    waypoints,
    addWaypoint,
    removeWaypoint,

    // Measurement
    measureMode,
    measurePoints,
    measureResult,
    toggleMeasureMode,
    addMeasurePoint,
    clearMeasure,

    // Map type
    mapType,
    setMapType,

    // Environmental
    depthFt,
    depthSeverity,
    waterTempF,
    windSpeedKts,
    windAngleDeg,
    currentSetDeg,
    currentDriftKts,

    // Lifecycle
    start,
    stop,
  }
}
