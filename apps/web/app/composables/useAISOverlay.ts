import { useSignalKStore } from '~/stores/signalk'
import { useVesselPosition } from '~/composables/useVesselPosition'
import type { AISVessel } from '~/types/map'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapkit is a CDN global with no published TypeScript types
declare const mapkit: any

/** Minimal MapKit map surface used by this composable (no official TS types). */
interface MapKitMap {
  setCenterAnimated(coord: unknown, animated: boolean): void
  addOverlay(overlay: unknown): void
  removeOverlay(overlay: unknown): void
  addAnnotation(ann: MapKitAnnotationRef): void
  removeAnnotation(ann: MapKitAnnotationRef): void
  addEventListener(type: string, handler: (e: MapKitSelectEvent) => void): void
  removeEventListener(type: string, handler: (e: MapKitSelectEvent) => void): void
  overlays?: unknown[]
  /** Selected annotation (drives callout visibility). */
  selectedAnnotation: unknown | null
}

interface MapKitAnnotationRef {
  coordinate: unknown
}

interface MapKitSelectEvent {
  annotation?: {
    data?: { vesselId?: string }
    coordinate?: { latitude: number; longitude: number }
  }
}

const AIS_CHECK_INTERVAL_MS = 1_000
const MOVEMENT_THRESHOLD_M = 15.24 // 50 feet
const PREDICTION_MINUTES = 15

/** AIS marker box — icon is flex-centered; rotation is around this center. */
const AIS_ANNOTATION_PX = { width: 24, height: 24 } as const

/** Grace period to move pointer from marker onto the callout without closing. */
const AIS_CALLOUT_HOVER_BRIDGE_MS = 240

// ── Geo Helpers ──────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function haversineNM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1852
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

/**
 * Project a point along a bearing from a start coordinate.
 * Returns [lat, lng] of the projected point.
 */
function projectPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceNM: number,
): [number, number] {
  const R = 3440.065 // Earth radius in NM
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

function fmtDeg(v: number | null): string {
  return v != null ? `${v.toFixed(0)}°` : '—'
}
function fmtKts(v: number | null): string {
  return v != null ? `${v.toFixed(1)} kts` : '—'
}

function vesselDisplayName(v: AISVessel): string {
  if (v.name) return v.name
  if (v.mmsi) return `MMSI ${v.mmsi}`
  const mmsiMatch = v.id.match(/mmsi[-:]?(\d+)/)
  if (mmsiMatch) return `MMSI ${mmsiMatch[1]}`
  return v.id.substring(0, 16)
}

// ── Ship Type Icon System ────────────────────────────────────

interface ShipCategory {
  label: string
  color: string
  iconSvg: (heading: number) => string
}

function svgShip(color: string, heading: number, size = 20): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L22 24 Q22 28 16 28 Q10 28 10 24 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
    </svg></div>`
}

function svgFishing(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L22 24 Q22 28 16 28 Q10 28 10 24 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <line x1="16" y1="4" x2="16" y2="0" stroke="${color}" stroke-width="2"/>
      <line x1="14" y1="1" x2="18" y2="1" stroke="${color}" stroke-width="1.5"/>
    </svg></div>`
}

function svgTug(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 6 L24 22 Q24 28 16 28 Q8 28 8 22 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <rect x="12" y="14" width="8" height="4" rx="1" fill="white" opacity="0.4"/>
    </svg></div>`
}

function svgSailing(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L20 24 Q20 28 16 28 Q12 28 12 24 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <line x1="16" y1="6" x2="16" y2="18" stroke="white" stroke-width="1.5" opacity="0.6"/>
    </svg></div>`
}

function svgCargo(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L24 10 L24 24 Q24 28 16 28 Q8 28 8 24 L8 10 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <rect x="12" y="12" width="8" height="8" rx="1" fill="white" opacity="0.3"/>
    </svg></div>`
}

function svgTanker(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 Q20 4 22 8 L24 22 Q24 28 16 28 Q8 28 8 22 L10 8 Q12 4 16 4 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <circle cx="16" cy="16" r="3" fill="white" opacity="0.3"/>
    </svg></div>`
}

function svgPassenger(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L22 10 L22 24 Q22 28 16 28 Q10 28 10 24 L10 10 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <line x1="12" y1="14" x2="20" y2="14" stroke="white" stroke-width="1" opacity="0.5"/>
      <line x1="12" y1="18" x2="20" y2="18" stroke="white" stroke-width="1" opacity="0.5"/>
    </svg></div>`
}

function svgHighSpeed(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2 L20 14 L24 26 Q20 28 16 28 Q12 28 8 26 L12 14 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
    </svg></div>`
}

function svgService(color: string, heading: number): string {
  return `<div style="transform:rotate(${heading}deg);transition:transform 0.3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));">
    <svg viewBox="0 0 32 32" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4 L24 12 L22 26 Q22 28 16 28 Q10 28 10 26 L8 12 Z" fill="${color}" stroke="white" stroke-width="1" stroke-linejoin="round"/>
      <circle cx="16" cy="16" r="2.5" fill="white" opacity="0.5"/>
    </svg></div>`
}

function svgDiamond(color: string): string {
  return `<div style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));">
    <svg viewBox="0 0 20 20" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="3" transform="rotate(45 10 10)" fill="${color}" stroke="white" stroke-width="1" opacity="0.75"/>
    </svg></div>`
}

type ShipCategoryKey =
  | 'fishing'
  | 'towing'
  | 'sailing'
  | 'pleasure'
  | 'highSpeed'
  | 'service'
  | 'passenger'
  | 'cargo'
  | 'tanker'
  | 'military'
  | 'default'
  | 'atRest'

const CATEGORIES = {
  fishing: { label: 'Fishing', color: '#16a34a', iconSvg: (h) => svgFishing('#16a34a', h) },
  towing: { label: 'Towing/Tug', color: '#ea580c', iconSvg: (h) => svgTug('#ea580c', h) },
  sailing: { label: 'Sailing', color: '#7c3aed', iconSvg: (h) => svgSailing('#7c3aed', h) },
  pleasure: { label: 'Pleasure Craft', color: '#2563eb', iconSvg: (h) => svgShip('#2563eb', h) },
  highSpeed: { label: 'High Speed', color: '#dc2626', iconSvg: (h) => svgHighSpeed('#dc2626', h) },
  service: { label: 'Service', color: '#0891b2', iconSvg: (h) => svgService('#0891b2', h) },
  passenger: { label: 'Passenger', color: '#0284c7', iconSvg: (h) => svgPassenger('#0284c7', h) },
  cargo: { label: 'Cargo', color: '#65a30d', iconSvg: (h) => svgCargo('#65a30d', h) },
  tanker: { label: 'Tanker', color: '#b91c1c', iconSvg: (h) => svgTanker('#b91c1c', h) },
  military: { label: 'Military', color: '#4b5563', iconSvg: (h) => svgShip('#4b5563', h) },
  default: { label: 'Vessel', color: '#0891b2', iconSvg: (h) => svgShip('#0891b2', h) },
  atRest: { label: 'Vessel', color: '#6b7280', iconSvg: (_h: number) => svgDiamond('#6b7280') },
} satisfies Record<ShipCategoryKey, ShipCategory>

function getShipCategory(shipType: number | null, sog: number | null): ShipCategory {
  if (shipType == null) return (sog ?? 0) > 0.5 ? CATEGORIES.default : CATEGORIES.atRest
  if (shipType === 30) return CATEGORIES.fishing
  if (shipType >= 31 && shipType <= 33) return CATEGORIES.towing
  if (shipType === 36) return CATEGORIES.sailing
  if (shipType === 37) return CATEGORIES.pleasure
  if (shipType >= 40 && shipType <= 49) return CATEGORIES.highSpeed
  if (shipType >= 50 && shipType <= 55) return CATEGORIES.service
  if (shipType >= 60 && shipType <= 69) return CATEGORIES.passenger
  if (shipType >= 70 && shipType <= 79) return CATEGORIES.cargo
  if (shipType >= 80 && shipType <= 89) return CATEGORIES.tanker
  if (shipType === 35) return CATEGORIES.military
  return (sog ?? 0) > 0.5 ? CATEGORIES.default : CATEGORIES.atRest
}

function shipTypeLabel(shipType: number | null): string {
  if (shipType == null) return 'Unknown Type'
  return getShipCategory(shipType, 1).label
}

// ── Callout Element Factory ──────────────────────────────────

function buildCalloutElement(
  v: AISVessel,
  selfLat: number | null,
  selfLng: number | null,
  vectorEnabled: boolean,
  onToggleVector: (id: string) => void,
): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 260px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08);
    padding: 12px 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #1a1a1a;
  `

  let distLabel = '—'
  let brgLabel = '—'
  if (v.lat != null && v.lng != null && selfLat != null && selfLng != null) {
    const d = haversineNM(selfLat, selfLng, v.lat, v.lng)
    distLabel = d < 1 ? `${(d * 2025.372).toFixed(0)} yd` : `${d.toFixed(1)} NM`
    const b = bearingTo(selfLat, selfLng, v.lat, v.lng)
    brgLabel = `${b.toFixed(0)}° ${cardinalLabel(b)}`
  }

  const name = vesselDisplayName(v)
  const isUnderway = (v.sog ?? 0) > 0.5
  const cat = getShipCategory(v.shipType, v.sog)
  const statusText = isUnderway ? 'UNDERWAY' : 'AT REST'
  const statusColor = isUnderway ? '#0891b2' : '#9ca3af'
  const nameFontSize = name.length <= 12 ? '16px' : name.length <= 20 ? '14px' : '13px'

  const destRow = v.destination
    ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;padding:4px 6px;background:#f0fdf4;border-radius:6px;font-size:10px;color:#15803d;">
        <span style="font-weight:600;">→</span> ${v.destination}
      </div>`
    : ''

  const dimParts: string[] = []
  if (v.length != null) dimParts.push(`${v.length}m`)
  if (v.beam != null) dimParts.push(`${v.beam}m beam`)
  if (v.draft != null) dimParts.push(`${v.draft}m draft`)
  const dimRow =
    dimParts.length > 0
      ? `<div style="font-size:10px;color:#aaa;margin-top:2px;">${dimParts.join(' × ')}</div>`
      : ''

  const callSignRow = v.callSign
    ? `<span style="color:#ccc;">·</span><span style="font-size:10px;color:#aaa;">${v.callSign}</span>`
    : ''

  // Vector toggle button (per-vessel)
  const vectorBtnColor = vectorEnabled ? '#0891b2' : '#ccc'
  const vectorBtnBg = vectorEnabled ? '#0891b215' : '#f5f5f5'

  el.innerHTML = `
    <div style="font-weight:700; font-size:${nameFontSize}; color:#111; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.3;">${name}</div>
    <div style="display:flex; align-items:center; gap:5px; margin-top:3px; flex-wrap:wrap;">
      <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:${cat.color}12;color:${cat.color};font-size:9px;font-weight:700;letter-spacing:0.03em;">
        <span style="width:6px;height:6px;border-radius:50%;background:${cat.color};"></span>
        ${shipTypeLabel(v.shipType)}
      </span>
      <span style="font-size:10px;color:${statusColor};font-weight:600;">${statusText}</span>
      ${v.mmsi ? `<span style="color:#ddd;">·</span><span style="font-size:10px;color:#bbb;">MMSI ${v.mmsi}</span>` : ''}
      ${callSignRow}
    </div>
    ${destRow}
    ${dimRow}
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px 0; border-top:1px solid #f0f0f0; padding-top:8px; margin-top:8px;">
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">SOG</div>
        <div style="font-weight:600; font-size:13px;">${fmtKts(v.sog)}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">COG</div>
        <div style="font-weight:600; font-size:13px;">${fmtDeg(v.cog)}${v.cog != null ? ` <span style="font-size:10px;color:#999;font-weight:400;">${cardinalLabel(v.cog)}</span>` : ''}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">HDG</div>
        <div style="font-weight:600; font-size:13px;">${fmtDeg(v.heading)}</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px 0; border-top:1px solid #f0f0f0; padding-top:8px; margin-top:8px;">
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">DIST</div>
        <div style="font-weight:600; font-size:13px;">${distLabel}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">BRG</div>
        <div style="font-weight:600; font-size:13px;">${brgLabel}</div>
      </div>
    </div>
    ${v.lat != null ? `<div style="text-align:center;font-size:10px;color:#bbb;margin-top:6px;font-variant-numeric:tabular-nums;">${v.lat.toFixed(5)}°, ${v.lng!.toFixed(5)}°</div>` : ''}
    <div style="display:flex;gap:6px;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
      <div id="vector-toggle-${v.id}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 0;border-radius:8px;background:${vectorBtnBg};color:${vectorBtnColor};font-size:10px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;">
        <span style="font-size:12px;">⟶</span> ${PREDICTION_MINUTES}min Vector
      </div>
      ${v.mmsi ? `<div id="mt-link-${v.id}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 0;border-radius:8px;background:#f0f7ff;color:#0284c7;font-size:10px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;">MarineTraffic <span style="font-size:11px;">↗</span></div>` : ''}
    </div>
  `

  // Wire vector toggle
  requestAnimationFrame(() => {
    const vectorBtn = el.querySelector(`#vector-toggle-${CSS.escape(v.id)}`)
    vectorBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      onToggleVector(v.id)
    })

    if (v.mmsi) {
      const mtBtn = el.querySelector(`#mt-link-${CSS.escape(v.id)}`)
      mtBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        window.open(
          `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}`,
          '_blank',
          'noopener,noreferrer',
        )
      })
    }
  })

  return el
}

// ── Composable ───────────────────────────────────────────────

/**
 * useAISOverlay — manages AIS vessel annotations and COG prediction
 * lines directly on the MapKit map instance.
 *
 * Features:
 * - Ship type-specific colored icons
 * - Native MapKit callouts with full vessel details
 * - 15-minute COG prediction vectors (polyline overlays)
 * - Global and per-vessel vector toggle
 * - Hover preview callout; click/tap pins it until map background dismisses
 * - Auto-center on map only while a vessel is pinned (clicked)
 */
// ── LocalStorage persistence for map overlay toggles ──
const MAP_PREFS_KEY = 'tideye:map-overlay-prefs'

interface MapOverlayPrefs {
  ais: boolean
  vectors: boolean
  labels: boolean
  vesselVectors: string[] // per-vessel vector toggle IDs
}

const DEFAULT_PREFS: MapOverlayPrefs = {
  ais: false,
  vectors: false,
  labels: true,
  vesselVectors: [],
}

function loadMapPrefs(): MapOverlayPrefs {
  try {
    if (!import.meta.client) return { ...DEFAULT_PREFS }
    const raw = localStorage.getItem(MAP_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) } as MapOverlayPrefs
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function saveMapPrefs(prefs: MapOverlayPrefs) {
  try {
    if (import.meta.client) localStorage.setItem(MAP_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* quota exceeded */
  }
}

export function useAISOverlay() {
  const store = useSignalKStore()
  const { lat, lng } = useVesselPosition()

  // ── Toggle State ──
  const showOtherVessels = computed({
    get: () => store.showOtherVessels,
    set: (v: boolean) => {
      store.showOtherVessels = v
    },
  })

  const showVectors = ref(false)
  const showLabels = ref(true)

  // Restore saved preferences AFTER hydration to avoid SSR mismatch
  // (server renders buttons with defaults; client must match until mounted)
  onMounted(() => {
    const saved = loadMapPrefs()
    store.showOtherVessels = saved.ais
    showVectors.value = saved.vectors
    showLabels.value = saved.labels
    for (const id of saved.vesselVectors) perVesselVectors.add(id)
  })

  // Per-vessel vector overrides: vessels in this set always show vectors
  const perVesselVectors = reactive(new Set<string>())

  const aisCount = computed(() =>
    store.showOtherVessels ? store.otherVesselsList.filter((v) => v.lat != null).length : 0,
  )

  // ── Map Object Storage ──
  const aisAnnotations = new Map<string, MapKitAnnotationRef>()
  const vectorOverlays = new Map<string, unknown>()
  const lastRendered = new Map<string, { lat: number; lng: number }>()
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  // ── Callout: hover preview vs click/tap pin ──
  let pinnedVesselId: string | null = null
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  let _deselectHandler: ((e: MapKitSelectEvent) => void) | null = null

  function clearAISHoverHideTimer() {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer)
      hoverHideTimer = null
    }
  }

  function scheduleAISCalloutHideOrRestorePinned() {
    clearAISHoverHideTimer()
    hoverHideTimer = setTimeout(() => {
      hoverHideTimer = null
      const map = getMap()
      if (!map) return
      if (pinnedVesselId) {
        const p = aisAnnotations.get(pinnedVesselId)
        map.selectedAnnotation = p ?? null
        if (!p) pinnedVesselId = null
      } else {
        map.selectedAnnotation = null
      }
    }, AIS_CALLOUT_HOVER_BRIDGE_MS)
  }

  function attachAISMarkerCalloutBehavior(
    map: MapKitMap,
    ann: MapKitAnnotationRef,
    markerEl: HTMLElement,
    vesselId: string,
  ) {
    markerEl.addEventListener('pointerenter', () => {
      clearAISHoverHideTimer()
      map.selectedAnnotation = ann
    })
    markerEl.addEventListener('pointerleave', () => {
      if (pinnedVesselId === vesselId) return
      scheduleAISCalloutHideOrRestorePinned()
    })
    markerEl.addEventListener('click', () => {
      pinnedVesselId = vesselId
      clearAISHoverHideTimer()
      map.selectedAnnotation = ann
    })
  }

  function attachAISCalloutHoverBridge(calloutRoot: HTMLElement, vesselId: string) {
    calloutRoot.addEventListener('pointerenter', () => {
      clearAISHoverHideTimer()
    })
    calloutRoot.addEventListener('pointerleave', () => {
      if (pinnedVesselId === vesselId) return
      scheduleAISCalloutHideOrRestorePinned()
    })
  }

  function getMap(): MapKitMap | null {
    try {
      return (mapkit?.maps?.[0] ?? null) as MapKitMap | null
    } catch {
      return null
    }
  }

  function centerOnCoord(map: MapKitMap, latitude: number, longitude: number) {
    map.setCenterAnimated(new mapkit.Coordinate(latitude, longitude), true)
  }

  // ── Per-Vessel Vector Toggle ──

  function _saveCurrentPrefs() {
    saveMapPrefs({
      ais: store.showOtherVessels,
      vectors: showVectors.value,
      labels: showLabels.value,
      vesselVectors: [...perVesselVectors],
    })
  }

  function toggleVesselVector(vesselId: string) {
    if (perVesselVectors.has(vesselId)) {
      perVesselVectors.delete(vesselId)
    } else {
      perVesselVectors.add(vesselId)
    }
    _saveCurrentPrefs()
    refreshVectors()
  }

  function isVectorEnabled(vesselId: string): boolean {
    return showVectors.value || perVesselVectors.has(vesselId)
  }

  // ── Vector (Prediction Line) Management ──

  function createVectorOverlay(v: AISVessel, map: MapKitMap) {
    if (v.lat == null || v.lng == null) return null
    const cog = v.cog ?? v.heading
    const sog = v.sog
    if (cog == null || sog == null || sog < 0.5) return null

    const distNM = sog * (PREDICTION_MINUTES / 60)
    const [endLat, endLng] = projectPoint(v.lat, v.lng, cog, distNM)

    const cat = getShipCategory(v.shipType, v.sog)
    const coords = [new mapkit.Coordinate(v.lat, v.lng), new mapkit.Coordinate(endLat, endLng)]

    const overlay = new mapkit.PolylineOverlay(coords, {
      style: new mapkit.Style({
        lineWidth: 2,
        lineDash: [6, 4],
        strokeColor: cat.color,
        strokeOpacity: 0.6,
      }),
    })
    map.addOverlay(overlay)
    return overlay
  }

  function refreshVectors() {
    const map = getMap()
    if (!map) return

    // Remove all existing vectors
    for (const [id, overlay] of vectorOverlays) {
      map.removeOverlay(overlay)
      vectorOverlays.delete(id)
    }

    if (!store.showOtherVessels) return

    // Recreate vectors for vessels that should have them
    for (const v of store.otherVesselsList) {
      if (!isVectorEnabled(v.id)) continue
      const overlay = createVectorOverlay(v, map)
      if (overlay) vectorOverlays.set(v.id, overlay)
    }
  }

  // ── Annotation Management ──

  function createAnnotation(v: AISVessel) {
    if (v.lat == null || v.lng == null) return null

    const heading = v.heading ?? v.cog ?? 0
    const cat = getShipCategory(v.shipType, v.sog)
    const coord = new mapkit.Coordinate(v.lat, v.lng)
    const name = vesselDisplayName(v)
    const hasRealName = !name.startsWith('MMSI') && !name.startsWith('urn')

    const map = getMap()
    if (!map) return null

    const ann = new mapkit.Annotation(
      coord,
      () => {
        // Outer container: sized to match annotation `size` so anchor center = icon center
        const el = document.createElement('div')
        el.style.cssText =
          'cursor:pointer; position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center; touch-action:manipulation;'

        // Icon — centered in the 24×24 box, rotation happens around its own center
        el.innerHTML = cat.iconSvg(heading)

        // Label — absolutely positioned below, doesn't affect anchor calculation
        if (hasRealName && showLabels.value) {
          const label = document.createElement('div')
          label.style.cssText =
            'position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:2px; font-family:-apple-system,sans-serif; font-size:9px; font-weight:600; color:#555; background:rgba(255,255,255,0.85); padding:1px 4px; border-radius:3px; white-space:nowrap; pointer-events:none; text-shadow:0 0 2px white;'
          label.textContent = name
          el.appendChild(label)
        }

        queueMicrotask(() => {
          const m = getMap()
          if (m) attachAISMarkerCalloutBehavior(m, ann, el, v.id)
        })

        return el
      },
      {
        // MapKit pins coordinate to bottom-center + offset; polyline starts at
        // the same lat/lng — offset up by half height so anchor = box center
        // (rotation center), independent of heading.
        anchorOffset: new DOMPoint(0, -AIS_ANNOTATION_PX.height / 2),
        calloutEnabled: true,
        animates: false,
        size: { ...AIS_ANNOTATION_PX },
        data: { vesselId: v.id },
        callout: {
          calloutElementForAnnotation: (annotation: { data?: { vesselId?: string } }) => {
            const id = annotation.data?.vesselId ?? v.id
            const fresh = store.otherVesselsList.find((x) => x.id === id)
            if (!fresh) return document.createElement('div')
            const root = buildCalloutElement(
              fresh,
              lat.value,
              lng.value,
              isVectorEnabled(fresh.id),
              toggleVesselVector,
            )
            queueMicrotask(() => attachAISCalloutHoverBridge(root, fresh.id))
            return root
          },
        },
      },
    )

    return ann
  }

  // ── Selection Events ──

  function bindSelectionEvents() {
    const map = getMap()
    if (!map) return

    _deselectHandler = (_e: MapKitSelectEvent) => {
      clearAISHoverHideTimer()
      queueMicrotask(() => {
        const m = getMap()
        if (m?.selectedAnnotation != null) return
        pinnedVesselId = null
      })
    }

    map.addEventListener('deselect', _deselectHandler)
  }

  function unbindSelectionEvents() {
    const map = getMap()
    if (map && _deselectHandler) map.removeEventListener('deselect', _deselectHandler)
    _deselectHandler = null
    clearAISHoverHideTimer()
    pinnedVesselId = null
  }

  // ── Main Refresh Loop ──

  function refreshAIS() {
    const map = getMap()
    if (!map) return

    if (!store.showOtherVessels) {
      for (const ann of aisAnnotations.values()) map.removeAnnotation(ann)
      for (const overlay of vectorOverlays.values()) map.removeOverlay(overlay)
      aisAnnotations.clear()
      vectorOverlays.clear()
      lastRendered.clear()
      pinnedVesselId = null
      return
    }

    const currentVessels = store.otherVesselsList.filter((v) => v.lat != null && v.lng != null)
    const currentIds = new Set(currentVessels.map((v) => v.id))

    // Remove stale
    for (const [id, ann] of aisAnnotations) {
      if (!currentIds.has(id)) {
        map.removeAnnotation(ann)
        aisAnnotations.delete(id)
        lastRendered.delete(id)
        if (pinnedVesselId === id) pinnedVesselId = null
      }
    }

    let anyMoved = false

    // Add or update
    for (const v of currentVessels) {
      const existing = aisAnnotations.get(v.id)
      const prev = lastRendered.get(v.id)

      if (!existing) {
        const ann = createAnnotation(v)
        if (ann) {
          map.addAnnotation(ann)
          aisAnnotations.set(v.id, ann)
          lastRendered.set(v.id, { lat: v.lat!, lng: v.lng! })
          anyMoved = true
        }
      } else if (
        prev &&
        haversineMeters(prev.lat, prev.lng, v.lat!, v.lng!) >= MOVEMENT_THRESHOLD_M
      ) {
        existing.coordinate = new mapkit.Coordinate(v.lat!, v.lng!)
        lastRendered.set(v.id, { lat: v.lat!, lng: v.lng! })
        anyMoved = true

        if (pinnedVesselId === v.id) {
          centerOnCoord(map, v.lat!, v.lng!)
        }
      }
    }

    // Refresh vectors if anything moved
    if (anyMoved) {
      refreshVectors()
    }
  }

  // ── Lifecycle ──

  function start() {
    const map = getMap()
    // Clear any orphaned overlays from prior HMR cycles
    if (map && map.overlays?.length) {
      const stale = [...map.overlays]
      for (const o of stale) map.removeOverlay(o)
    }
    refreshAIS()
    bindSelectionEvents()
    refreshTimer = setInterval(refreshAIS, AIS_CHECK_INTERVAL_MS)
  }

  function stop() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    unbindSelectionEvents()
    const map = getMap()
    if (map) {
      for (const ann of aisAnnotations.values()) map.removeAnnotation(ann)
      for (const overlay of vectorOverlays.values()) map.removeOverlay(overlay)
    }
    aisAnnotations.clear()
    vectorOverlays.clear()
    lastRendered.clear()
  }

  // React to toggle changes + persist to localStorage
  watch(
    () => store.showOtherVessels,
    () => {
      _saveCurrentPrefs()
      refreshAIS()
    },
  )
  watch(showVectors, () => {
    _saveCurrentPrefs()
    refreshVectors()
  })
  // When labels toggle changes, rebuild all vessel annotations to add/remove labels
  watch(showLabels, () => {
    _saveCurrentPrefs()
    const map = getMap()
    if (!map) return
    for (const ann of aisAnnotations.values()) map.removeAnnotation(ann)
    aisAnnotations.clear()
    lastRendered.clear()
    refreshAIS()
  })

  return {
    showOtherVessels,
    showVectors,
    showLabels,
    aisCount,
    start,
    stop,
  }
}
