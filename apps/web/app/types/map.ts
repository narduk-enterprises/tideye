/** AIS target vessel data extracted from SignalK deltas */
export interface AISVessel {
  id: string
  name: string | null
  mmsi: string | null
  shipType: number | null // AIS ship type code (30=fishing, 60-69=passenger, 70-79=cargo, 80-89=tanker, etc.)
  lat: number | null
  lng: number | null
  cog: number | null // degrees
  sog: number | null // knots
  heading: number | null // degrees
  lastUpdate: number // timestamp ms
  // Enhanced AIS fields
  destination: string | null
  callSign: string | null
  length: number | null // meters
  beam: number | null // meters
  draft: number | null // meters
  navState: string | null // e.g. "moored", "under way using engine"
}

/** Generic item for AppMapKit (requires id, lat, lng) */
export interface MapVesselItem {
  id: string
  lat: number
  lng: number
  type: 'self' | 'ais'
  name?: string | null
  heading?: number | null
  sog?: number | null
  cog?: number | null
  mmsi?: string | null
}
