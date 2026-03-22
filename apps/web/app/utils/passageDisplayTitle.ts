import type { PassageDto, PassagePlaceDto, PassagePlacesResponse } from '~/types/passage'

const PLACE_LABEL_MAX = 40

/** Compact degree label for cards when place names are missing (e.g. 30.22°N 93.22°W). */
export function formatCoordCompact(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`
}

/** Decimal pair for small subtext under route headlines. */
export function passageCoordSubtext(passage: PassageDto) {
  return `${passage.startLat.toFixed(5)}, ${passage.startLon.toFixed(5)} → ${passage.endLat.toFixed(5)}, ${passage.endLon.toFixed(5)}`
}

function primaryPlaceLabel(place: PassagePlaceDto | null): string | null {
  if (!place) return null
  const name = place.name?.trim()
  if (name) return name
  const line0 = place.formattedAddressLines?.[0]?.trim()
  if (line0) return line0
  const loc = place.locality?.trim()
  if (loc) return loc
  return null
}

function truncateLabel(s: string, max = PLACE_LABEL_MAX) {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/** Matches seed coordinate-only titles (compact °N/°W segments) so we do not treat them as place names. */
const COORD_ONLY_HEADLINE = /^\d+\.\d+°[NS]\s+\d+\.\d+°[EW]\s*→\s*\d+\.\d+°[NS]\s+\d+\.\d+°[EW]$/i

/**
 * Use stored `title` when it already contains a geocoded "A → B · X nm" (labels column empty on old rows).
 */
export function headlineFromStoredTitle(title: string | null | undefined): string | null {
  const t = title?.trim()
  if (!t) return null
  const stripped = t.replace(/\s*·\s*[\d.]+\s*nm\s*$/i, '').trim()
  if (!stripped || !stripped.includes('→')) return null
  if (COORD_ONLY_HEADLINE.test(stripped)) return null
  return truncateLabel(stripped)
}

/**
 * Start → end location for UI headlines (no distance suffix).
 * Uses stored labels, /places when provided, geocoded title text, else compact coordinates.
 */
export function passageRouteHeadline(
  passage: PassageDto,
  places: PassagePlacesResponse | null | undefined,
): string {
  const dbStart = passage.startPlaceLabel?.trim()
  const dbEnd = passage.endPlaceLabel?.trim()
  if (dbStart && dbEnd) {
    return `${truncateLabel(dbStart)} → ${truncateLabel(dbEnd)}`
  }
  if (places && !places.error) {
    const left = primaryPlaceLabel(places.start)
    const right = primaryPlaceLabel(places.end)
    if (left && right) return `${truncateLabel(left)} → ${truncateLabel(right)}`
  }
  const fromTitle = headlineFromStoredTitle(passage.title)
  if (fromTitle) return fromTitle
  return `${formatCoordCompact(passage.startLat, passage.startLon)} → ${formatCoordCompact(passage.endLat, passage.endLon)}`
}

/**
 * Full line with distance (SEO, tooltips) — prefers names when available.
 */
export function passageDisplayTitle(
  passage: PassageDto,
  places: PassagePlacesResponse | null | undefined,
): string {
  return `${passageRouteHeadline(passage, places)} · ${passage.distanceNm} nm`
}
