import { auth } from '../../../lib/auth'
import { desc, count, and, eq, ilike, gte, lte } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const headers = event.headers

  let session = await auth.api.getSession({ headers }).catch(() => null)

  if (!session) {
    const apiKey = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (apiKey) {
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
      if (!result.valid) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
      }
      // @ts-expect-error - API key authentication creates a minimal session object
      session = { user: result.key, session: null }
    }
  }

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = (page - 1) * limit

  const fromDomain = query.fromDomain as string | undefined
  const to = query.to as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  const conditions = [
    fromDomain ? eq(emailSends.fromDomain, fromDomain) : undefined,
    to ? ilike(emailSends.to, `%${to}%`) : undefined,
    dateFrom ? gte(emailSends.createdAt, new Date(dateFrom)) : undefined,
    dateTo ? lte(emailSends.createdAt, new Date(dateTo + 'T23:59:59.999Z')) : undefined,
  ].filter(Boolean) as Parameters<typeof and>

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(emailSends)
      .where(whereClause)
      .orderBy(desc(emailSends.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(emailSends).where(whereClause),
  ])

  return {
    items,
    total: countResult[0]?.total ?? 0,
    page,
    limit,
  }
})
