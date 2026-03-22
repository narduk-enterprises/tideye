import { desc } from 'drizzle-orm'
import { passages } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const db = useAppDatabase(event)
  return await db.select().from(passages).orderBy(desc(passages.startedAt))
})
