import type { PassageAisProfileV1, PassageAisSample } from '~/types/passageTraffic'

export interface PassagePlaybackSummary {
  distanceNm: number
  durationHours: number
  avgSog: number | null
  maxSog: number | null
  startBearing: number | null
  endBearing: number | null
}

export interface PassagePlaybackSelfSample {
  t: string
  lat: number
  lon: number
  sog: number | null
  cog: number | null
  headingTrue: number | null
  depth?: number | null
  waterTempC?: number | null
  airTempC?: number | null
  windAppSpeedKts?: number | null
  windAppAngleDeg?: number | null
  windTrueSpeedKts?: number | null
  windTrueDirectionDeg?: number | null
  portRpm?: number | null
  starboardRpm?: number | null
  barometerHpa?: number | null
}

export interface PassagePlaybackTrafficVessel {
  profile: PassageAisProfileV1
  samples: PassageAisSample[]
}

export interface PassagePlaybackGeojsonFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: unknown
  }
}

export interface PassagePlaybackGeojson {
  type: 'FeatureCollection'
  features: PassagePlaybackGeojsonFeature[]
}

export interface PassagePlaybackBundle {
  v: number
  id: string
  title: string
  startedAt: string
  endedAt: string
  startLat: number
  startLon: number
  endLat: number
  endLon: number
  startPlaceLabel: string | null
  endPlaceLabel: string | null
  overviewTrackGeojson: PassagePlaybackGeojson | null
  summary: PassagePlaybackSummary
  self: {
    window: string | null
    samples: PassagePlaybackSelfSample[]
  }
  traffic: {
    window: string | null
    vessels: PassagePlaybackTrafficVessel[]
  }
  source: 'generated-bundle' | 'd1-compact'
  note?: string | null
}
