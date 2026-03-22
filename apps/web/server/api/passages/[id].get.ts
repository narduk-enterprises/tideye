import { eq } from 'drizzle-orm'
import { passages } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing passage id' })
  }

  const db = useAppDatabase(event)
  const [row] = await db.select().from(passages).where(eq(passages.id, id)).limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Passage not found' })
  }

  return row
})
