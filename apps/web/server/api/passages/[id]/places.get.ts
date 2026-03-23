import { eq } from 'drizzle-orm'
import { passages } from '#server/database/schema'
import type { PassagePlaceDto } from '~/types/passage'

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
  return {
    start: startStored,
    end: endStored,
    error: null,
  }
})
