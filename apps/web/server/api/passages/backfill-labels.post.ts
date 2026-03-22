import { count, desc, eq, isNull, or } from 'drizzle-orm'
import {
  reverseGeocodeWithServerApi,
  type AppleMapsCreds,
  type AppleMapsSearchResult,
} from '#layer/server/utils/apple-maps'
import { passages } from '#server/database/schema'

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

function pickLine(r: AppleMapsSearchResult | null): string | null {
  if (!r) return null
  if (r.name) return String(r.name).trim()
  const lines = r.formattedAddressLines
  if (Array.isArray(lines) && lines[0]) return String(lines[0]).trim()
  const loc = r.structuredAddress?.locality
  if (loc) return String(loc).trim()
  return null
}

function truncateTitle(s: string, max: number) {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/** Rows missing either place label (null or empty). */
function needsBackfillCondition() {
  const emptyStart = or(isNull(passages.startPlaceLabel), eq(passages.startPlaceLabel, ''))
  const emptyEnd = or(isNull(passages.endPlaceLabel), eq(passages.endPlaceLabel, ''))
  return or(emptyStart, emptyEnd)
}

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'passages-backfill-labels', 15, 3_600_000)

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
          : reverseGeocodeWithServerApi(creds, row.startLat, row.startLon),
        hasEnd ? Promise.resolve(null) : reverseGeocodeWithServerApi(creds, row.endLat, row.endLon),
      ])

      const startName = hasStart ? row.startPlaceLabel!.trim() : pickLine(startRaw)
      const endName = hasEnd ? row.endPlaceLabel!.trim() : pickLine(endRaw)
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

  const [countRow] = await db.select({ c: count() }).from(passages).where(needsBackfillCondition())

  return { updated, remaining: Number(countRow?.c ?? 0) }
})
