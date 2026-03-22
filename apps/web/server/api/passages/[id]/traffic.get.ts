import { eq } from 'drizzle-orm'
import { passageAisVessels } from '#server/database/schema'
import type { PassageAisTrafficRow } from '~/types/passageTraffic'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing passage id' })
  }

  const db = useAppDatabase(event)
  const rows = await db.select().from(passageAisVessels).where(eq(passageAisVessels.passageId, id))

  const out: PassageAisTrafficRow[] = []
  for (const r of rows) {
    try {
      const profile = JSON.parse(r.profileJson) as PassageAisTrafficRow['profile']
      const samples = JSON.parse(r.samplesJson) as PassageAisTrafficRow['samples']
      out.push({
        passageId: r.passageId,
        mmsi: r.mmsi,
        profile,
        samples,
      })
    } catch {
      /* skip corrupt row */
    }
  }
  return out
})
