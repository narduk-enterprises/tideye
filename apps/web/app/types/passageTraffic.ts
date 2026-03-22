/** Matches `profile_json` from passage_ais_vessels (Influx seed export). */
export interface PassageAisProfileV1 {
  v: 1
  contextUrn: string
  mmsi: string
  name: string | null
  shipTypeId: number | null
  shipTypeName: string | null
  lengthM: number | null
  beamM: number | null
  draftM: number | null
  destination: string | null
  note?: string
}

export interface PassageAisSample {
  t: string
  lat: number
  lon: number
  sog: number | null
  cog: number | null
  hdg: number | null
}

export interface PassageAisTrafficRow {
  passageId: string
  mmsi: string
  profile: PassageAisProfileV1
  samples: PassageAisSample[]
}
