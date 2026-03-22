import { eq } from 'drizzle-orm'
import {
  reverseGeocodeWithServerApi,
  type AppleMapsCreds,
  type AppleMapsSearchResult,
} from '#layer/server/utils/apple-maps'
import { passages } from '#server/database/schema'
import type { PassagePlaceDto } from '~/types/passage'

function appleCredsFromRuntime(event: Parameters<typeof useRuntimeConfig>[0]): AppleMapsCreds {
  const config = useRuntimeConfig(event)
  return {
    mapkitServerApiKey: config.mapkitServerApiKey || '',
    appleTeamId: config.appleTeamId || '',
    appleKeyId: config.appleKeyId || '',
    appleSecretKey: config.appleSecretKey || '',
  }
}

function hasAppleMapsServerCreds(creds: AppleMapsCreds) {
  const jwt = creds.mapkitServerApiKey?.trim()
  if (jwt) return true
  return Boolean(creds.appleTeamId && creds.appleKeyId && creds.appleSecretKey)
}

function toPlaceDto(r: AppleMapsSearchResult | null) {
  if (!r) return null
  return {
    name: r.name ?? r.formattedAddressLines?.[0] ?? null,
    formattedAddressLines: r.formattedAddressLines ?? [],
    locality: r.structuredAddress?.locality ?? null,
    administrativeArea: r.structuredAddress?.administrativeArea ?? null,
    country: r.country ?? null,
  }
}

function placeFromStoredLabel(label: string | null): PassagePlaceDto | null {
  const s = label?.trim()
  if (!s) return null
  return {
    name: s,
    formattedAddressLines: [s],
    locality: null,
    administrativeArea: null,
    country: null,
  }
}

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'passages-places', 120, 60_000)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing passage id' })
  }

  const db = useAppDatabase(event)
  const [row] = await db.select().from(passages).where(eq(passages.id, id)).limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Passage not found' })
  }

  const startStored = placeFromStoredLabel(row.startPlaceLabel)
  const endStored = placeFromStoredLabel(row.endPlaceLabel)
  if (startStored && endStored) {
    return {
      start: startStored,
      end: endStored,
      error: null,
    }
  }

  const creds = appleCredsFromRuntime(event)
  if (!hasAppleMapsServerCreds(creds)) {
    return {
      start: startStored,
      end: endStored,
      error:
        startStored || endStored ? null : 'Apple Maps Server API credentials are not configured',
    }
  }

  try {
    const [startRaw, endRaw] = await Promise.all([
      startStored
        ? Promise.resolve(null)
        : reverseGeocodeWithServerApi(creds, row.startLat, row.startLon),
      endStored
        ? Promise.resolve(null)
        : reverseGeocodeWithServerApi(creds, row.endLat, row.endLon),
    ])

    return {
      start: startStored ?? toPlaceDto(startRaw),
      end: endStored ?? toPlaceDto(endRaw),
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reverse geocoding failed'
    return {
      start: startStored,
      end: endStored,
      error: message,
    }
  }
})
