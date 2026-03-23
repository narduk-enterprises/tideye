import { count, desc, eq, isNull, or } from 'drizzle-orm'
import { getDeveloperToken, type AppleMapsCreds } from '#layer/server/utils/apple-maps'
import { passages } from '#server/database/schema'
import { definePublicMutation } from '#layer/server/utils/mutation'

const BATCH = 20
const LABEL_MAX = 200
const TITLE_CHUNK = 40

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

function truncateTitle(s: string, max: number) {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

interface AppleReverseGeocodeResult {
  name?: string
  displayName?: string
  formattedAddressLines?: string[]
  structuredAddress?: {
    fullThoroughfare?: string
    thoroughfare?: string
    subThoroughfare?: string
    locality?: string
    administrativeArea?: string
    country?: string
  }
}

function pickContextualPlaceLabel(result: AppleReverseGeocodeResult | null): string | null {
  if (!result) return null

  const candidates = [
    result.displayName,
    result.name,
    result.formattedAddressLines?.[0],
    result.structuredAddress?.fullThoroughfare,
    [result.structuredAddress?.subThoroughfare, result.structuredAddress?.thoroughfare]
      .filter(Boolean)
      .join(' '),
    [
      result.structuredAddress?.locality,
      result.structuredAddress?.administrativeArea,
      result.structuredAddress?.country,
    ]
      .filter(Boolean)
      .join(', '),
  ]

  for (const candidate of candidates) {
    const label = candidate?.trim()
    if (label) return label
  }

  return null
}

async function resolveContextualPlaceLabelWithServerApi(
  creds: AppleMapsCreds,
  lat: number,
  lng: number,
): Promise<string | null> {
  const accessToken = await getDeveloperToken(creds)
  const url = new URL('https://maps-api.apple.com/v1/reverseGeocode')
  url.searchParams.set('loc', `${lat},${lng}`)
  url.searchParams.set('lang', 'en-US')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as { results?: AppleReverseGeocodeResult[] }
  return pickContextualPlaceLabel(data.results?.[0] ?? null)
}

/** Rows missing either place label (null or empty). */
function needsBackfillCondition() {
  const emptyStart = or(isNull(passages.startPlaceLabel), eq(passages.startPlaceLabel, ''))
  const emptyEnd = or(isNull(passages.endPlaceLabel), eq(passages.endPlaceLabel, ''))
  return or(emptyStart, emptyEnd)
}

const BACKFILL_RATE = {
  namespace: 'passages-backfill-labels',
  maxRequests: 15,
  windowMs: 3_600_000,
}

export default definePublicMutation(
  {
    rateLimit: BACKFILL_RATE,
  },
  async ({ event }) => {
    const creds = appleCredsFromRuntime(event)
    if (!hasAppleMapsServerCreds(creds)) {
      return { updated: 0, message: 'Apple Maps Server API credentials are not configured' }
    }

    const db = useAppDatabase(event)

    const candidates = await db
      .select()
      .from(passages)
      .where(needsBackfillCondition())
      .orderBy(desc(passages.startedAt))
      .limit(BATCH)

    let updated = 0
    for (const row of candidates) {
      const hasStart = Boolean(row.startPlaceLabel?.trim())
      const hasEnd = Boolean(row.endPlaceLabel?.trim())
      if (hasStart && hasEnd) continue

      try {
        const [startRaw, endRaw] = await Promise.all([
          hasStart
            ? Promise.resolve(null)
            : resolveContextualPlaceLabelWithServerApi(creds, row.startLat, row.startLon),
          hasEnd
            ? Promise.resolve(null)
            : resolveContextualPlaceLabelWithServerApi(creds, row.endLat, row.endLon),
        ])

        const startName = hasStart ? row.startPlaceLabel!.trim() : startRaw?.trim() || null
        const endName = hasEnd ? row.endPlaceLabel!.trim() : endRaw?.trim() || null
        if (!startName || !endName) continue

        const startStore = (hasStart ? row.startPlaceLabel!.trim() : startName).slice(0, LABEL_MAX)
        const endStore = (hasEnd ? row.endPlaceLabel!.trim() : endName).slice(0, LABEL_MAX)
        const left = truncateTitle(startName, TITLE_CHUNK)
        const right = truncateTitle(endName, TITLE_CHUNK)
        const newTitle = `${left} → ${right} · ${row.distanceNm} nm`

        await db
          .update(passages)
          .set({
            startPlaceLabel: startStore,
            endPlaceLabel: endStore,
            title: newTitle,
          })
          .where(eq(passages.id, row.id))

        updated++
      } catch {
        // Skip row on Apple or DB errors; continue batch
      }

      await new Promise((r) => setTimeout(r, 90))
    }

    const [countRow] = await db
      .select({ c: count() })
      .from(passages)
      .where(needsBackfillCondition())

    return { updated, remaining: Number(countRow?.c ?? 0) }
  },
)
