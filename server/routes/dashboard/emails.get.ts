import { desc, count } from 'drizzle-orm'
import { db } from '../../db/index'
import { emailSends } from '../../db/schema'
import { auth } from '../../lib/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = (page - 1) * limit

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(emailSends)
      .orderBy(desc(emailSends.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(emailSends),
  ])

  return {
    items,
    total: countResult[0]?.total ?? 0,
    page,
    limit,
  }
})
