import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { passageAisVessels, passages } from '#server/database/schema'
import type {
  PassagePlaybackBundle,
  PassagePlaybackGeojson,
  PassagePlaybackSelfSample,
  PassagePlaybackSummary,
  PassagePlaybackTrafficVessel,
} from '~/types/passagePlayback'
import type { PassageAisProfileV1, PassageAisSample } from '~/types/passageTraffic'
import { useR2 } from '#layer/server/utils/r2'

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value?.trim()) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeSummary(
  row: (typeof passages.$inferSelect) | null,
  raw: Record<string, unknown> | null,
): PassagePlaybackSummary {
  return {
    distanceNm: toNumber(raw?.distanceNm, Number(row?.distanceNm || 0)),
    durationHours: toNumber(raw?.durationHours, 0),
    avgSog: toNullableNumber(raw?.avgSog),
    maxSog: toNullableNumber(raw?.maxSog),
    startBearing: toNullableNumber(raw?.startBearing),
    endBearing: toNullableNumber(raw?.endBearing),
  }
}

function normalizeSelfSamples(value: unknown): PassagePlaybackSelfSample[] {
  if (!Array.isArray(value)) return []

  const out: PassagePlaybackSelfSample[] = []
  for (const sample of value) {
    if (!sample || typeof sample !== 'object') continue
    const record = sample as Record<string, unknown>
    if (typeof record.t !== 'string') continue

    const lat = toNullableNumber(record.lat)
    const lon = toNullableNumber(record.lon)
    if (lat == null || lon == null) continue

    out.push({
      t: record.t,
      lat,
      lon,
      sog: toNullableNumber(record.sog),
      cog: toNullableNumber(record.cog),
      headingTrue: toNullableNumber(record.headingTrue),
      depth: toNullableNumber(record.depth),
      waterTempC: toNullableNumber(record.waterTempC),
      airTempC: toNullableNumber(record.airTempC),
      windAppSpeedKts: toNullableNumber(record.windAppSpeedKts),
      windAppAngleDeg: toNullableNumber(record.windAppAngleDeg),
      windTrueSpeedKts: toNullableNumber(record.windTrueSpeedKts),
      windTrueDirectionDeg: toNullableNumber(record.windTrueDirectionDeg),
      portRpm: toNullableNumber(record.portRpm),
      starboardRpm: toNullableNumber(record.starboardRpm),
      barometerHpa: toNullableNumber(record.barometerHpa),
    })
  }

  out.sort((left, right) => left.t.localeCompare(right.t))
  return out
}

function normalizeTrafficProfile(value: unknown): PassageAisProfileV1 | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.mmsi !== 'string') return null

  return {
    v: 1,
    contextUrn: typeof record.contextUrn === 'string' ? record.contextUrn : '',
    mmsi: record.mmsi,
    name: typeof record.name === 'string' ? record.name : null,
    shipTypeId: toNullableNumber(record.shipTypeId),
    shipTypeName: typeof record.shipTypeName === 'string' ? record.shipTypeName : null,
    lengthM: toNullableNumber(record.lengthM),
    beamM: toNullableNumber(record.beamM),
    draftM: toNullableNumber(record.draftM),
    destination: typeof record.destination === 'string' ? record.destination : null,
    aisClass: typeof record.aisClass === 'string' ? record.aisClass : null,
    note: typeof record.note === 'string' ? record.note : undefined,
  }
}

function normalizeTrafficSamples(value: unknown): PassageAisSample[] {
  if (!Array.isArray(value)) return []
  const out: PassageAisSample[] = []
  for (const sample of value) {
    if (!sample || typeof sample !== 'object') continue
    const record = sample as Record<string, unknown>
    if (typeof record.t !== 'string') continue
    const lat = toNullableNumber(record.lat)
    const lon = toNullableNumber(record.lon)
    if (lat == null || lon == null) continue

    out.push({
      t: record.t,
      lat,
      lon,
      sog: toNullableNumber(record.sog),
      cog: toNullableNumber(record.cog),
      hdg: toNullableNumber(record.hdg),
    })
  }
  out.sort((left, right) => left.t.localeCompare(right.t))
  return out
}

function normalizeTrafficVessels(value: unknown): PassagePlaybackTrafficVessel[] {
  if (!Array.isArray(value)) return []
  const out: PassagePlaybackTrafficVessel[] = []
  for (const vessel of value) {
    if (!vessel || typeof vessel !== 'object') continue
    const record = vessel as Record<string, unknown>
    const profile = normalizeTrafficProfile(record.profile)
    if (!profile) continue
    out.push({
      profile,
      samples: normalizeTrafficSamples(record.samples),
    })
  }
  return out
}

function normalizeGeojson(value: unknown): PassagePlaybackGeojson | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.type !== 'FeatureCollection' || !Array.isArray(record.features)) return null
  return record as unknown as PassagePlaybackGeojson
}

async function loadGeneratedPlaybackBundle(id: string): Promise<PassagePlaybackBundle | null> {
  try {
    const [{ access }, pathModule, urlModule] = await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
      import('node:url'),
    ])

    const fromEnv = process.env.PASSAGE_EXPORT_OUT_DIR?.trim()
    const cwd = process.cwd()
    const fallbackRoot = urlModule.fileURLToPath(
      new URL('../../../../../../tools/.generated/passage-playback', import.meta.url),
    )

    const rootCandidates = Array.from(
      new Set(
        [
          fromEnv ? pathModule.resolve(fromEnv) : null,
          pathModule.resolve(cwd, 'tools/.generated/passage-playback'),
          pathModule.resolve(cwd, '../tools/.generated/passage-playback'),
          pathModule.resolve(cwd, '../../tools/.generated/passage-playback'),
          pathModule.resolve(cwd, '../../../tools/.generated/passage-playback'),
          pathModule.resolve(cwd, '../../../../tools/.generated/passage-playback'),
          pathModule.resolve(fallbackRoot),
        ].filter((value): value is string => Boolean(value)),
      ),
    )

    const candidates = rootCandidates.flatMap((root) => [
      pathModule.resolve(root, 'passages', `${id}.json`),
      pathModule.resolve(root, `${id}.json`),
    ])

    for (const candidate of candidates) {
      try {
        await access(candidate)
      } catch {
        continue
      }

      const payload = await readFileUtf8(candidate)
      const parsed = safeJsonParse<PassagePlaybackBundle>(payload)
      if (!parsed || parsed.id !== id) continue

      return {
        ...parsed,
        overviewTrackGeojson: normalizeGeojson(parsed.overviewTrackGeojson),
        self: {
          window: parsed.self?.window ?? null,
          samples: normalizeSelfSamples(parsed.self?.samples),
        },
        traffic: {
          window: parsed.traffic?.window ?? null,
          vessels: normalizeTrafficVessels(parsed.traffic?.vessels),
        },
        summary: normalizeSummary(null, parsed.summary as unknown as Record<string, unknown>),
        source: 'generated-bundle',
      }
    }
  } catch {
    return null
  }

  return null
}

async function loadPlaybackBundleFromR2(
  event: H3Event,
  id: string,
): Promise<PassagePlaybackBundle | null> {
  try {
    const r2 = useR2(event, 'PLAYBACK')
    const key = `passage-playback/passages/${id}.json`
    const obj = await r2.get(key)
    if (!obj) return null

    const payload = await obj.text()
    const parsed = safeJsonParse<PassagePlaybackBundle>(payload)
    if (!parsed || parsed.id !== id) return null

    return {
      ...parsed,
      overviewTrackGeojson: normalizeGeojson(parsed.overviewTrackGeojson),
      self: {
        window: parsed.self?.window ?? null,
        samples: normalizeSelfSamples(parsed.self?.samples),
      },
      traffic: {
        window: parsed.traffic?.window ?? null,
        vessels: normalizeTrafficVessels(parsed.traffic?.vessels),
      },
      summary: normalizeSummary(null, parsed.summary as unknown as Record<string, unknown>),
      source: 'generated-bundle',
    }
  } catch {
    return null
  }
}

async function readFileUtf8(path: string) {
  const { readFile } = await import('node:fs/promises')
  return await readFile(path, 'utf8')
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing passage id' })
  }

  const generated = await loadGeneratedPlaybackBundle(id)
  if (generated) {
    return generated
  }

  const r2Bundle = await loadPlaybackBundleFromR2(event, id)
  if (r2Bundle) {
    return r2Bundle
  }

  const db = useAppDatabase(event)
  const [row] = await db.select().from(passages).where(eq(passages.id, id)).limit(1)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Passage not found' })
  }

  const trafficRows = await db
    .select()
    .from(passageAisVessels)
    .where(eq(passageAisVessels.passageId, id))

  const trafficVessels: PassagePlaybackTrafficVessel[] = []
  for (const trafficRow of trafficRows) {
    const profile = normalizeTrafficProfile(safeJsonParse<Record<string, unknown>>(trafficRow.profileJson))
    if (!profile) continue
    trafficVessels.push({
      profile,
      samples: normalizeTrafficSamples(
        safeJsonParse<Record<string, unknown>[]>(trafficRow.samplesJson),
      ),
    })
  }

  const playback = safeJsonParse<Record<string, unknown>>(row.playbackJson)

  return {
    v: toNumber(playback?.v, 2),
    id: row.id,
    title: row.title,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    startLat: row.startLat,
    startLon: row.startLon,
    endLat: row.endLat,
    endLon: row.endLon,
    startPlaceLabel: row.startPlaceLabel ?? null,
    endPlaceLabel: row.endPlaceLabel ?? null,
    overviewTrackGeojson: normalizeGeojson(safeJsonParse(row.trackGeojson)),
    summary: normalizeSummary(row, playback?.summary as Record<string, unknown> | null),
    self: {
      window: typeof playback?.selfWindow === 'string' ? playback.selfWindow : null,
      samples: normalizeSelfSamples(playback?.samples),
    },
    traffic: {
      window:
        playback?.traffic && typeof playback.traffic === 'object'
          ? typeof (playback.traffic as Record<string, unknown>).window === 'string'
            ? ((playback.traffic as Record<string, unknown>).window as string)
            : null
          : null,
      vessels: trafficVessels,
    },
    source: 'd1-compact',
    note: typeof playback?.note === 'string' ? playback.note : null,
  } satisfies PassagePlaybackBundle
})
