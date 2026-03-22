import { desc } from 'drizzle-orm'
import { passages } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  return await db
    .select({
      id: passages.id,
      title: passages.title,
      startedAt: passages.startedAt,
      endedAt: passages.endedAt,
      startLat: passages.startLat,
      startLon: passages.startLon,
      endLat: passages.endLat,
      endLon: passages.endLon,
      distanceNm: passages.distanceNm,
      positionSource: passages.positionSource,
      createdAt: passages.createdAt,
      trackGeojson: passages.trackGeojson,
      startPlaceLabel: passages.startPlaceLabel,
      endPlaceLabel: passages.endPlaceLabel,
      segmentGroupId: passages.segmentGroupId,
      segmentIndex: passages.segmentIndex,
    })
    .from(passages)
    .orderBy(desc(passages.startedAt))
})
