/** Passage row as returned by `/api/passages` (matches Drizzle `passages` table). */
export interface PassageDto {
  id: string
  title: string
  startedAt: string
  endedAt: string
  startLat: number
  startLon: number
  endLat: number
  endLon: number
  distanceNm: number
  positionSource: string
  createdAt: string
  /** GeoJSON LineString or FeatureCollection (lon/lat order) for map track */
  trackGeojson: string | null
  /** Apple reverse-geocode at seed; avoids per-request geocoding */
  startPlaceLabel: string | null
  endPlaceLabel: string | null
  /** Same id for rows split from one long voyage (sub-daily segmentation) */
  segmentGroupId?: string | null
  /** Order within a split group (0-based) */
  segmentIndex?: number
  /** Decimated telemetry samples for playback UI (optional) */
  playbackJson?: string | null
}

/** Single reverse-geocoded endpoint from Apple Maps Server API. */
export interface PassagePlaceDto {
  name: string | null
  formattedAddressLines: string[]
  locality: string | null
  administrativeArea: string | null
  country: string | null
}

/** `GET /api/passages/:id/places` */
export interface PassagePlacesResponse {
  start: PassagePlaceDto | null
  end: PassagePlaceDto | null
  error: string | null
}
