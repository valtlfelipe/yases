import { desc, count, and, eq, ilike, gte, lte } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends, emailStatusEnum } from '../../../db/schema'
import { requireApiAuth } from '../../../utils/requireApiAuth'

type EmailStatus = (typeof emailStatusEnum.enumValues)[number]
const VALID_STATUSES = new Set<string>(emailStatusEnum.enumValues)

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = (page - 1) * limit

  const fromDomain = query.fromDomain as string | undefined
  const to = query.to as string | undefined
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const statusParam = query.status as string | undefined
  const status = statusParam && VALID_STATUSES.has(statusParam) ? statusParam as EmailStatus : undefined

  const conditions = [
    fromDomain ? eq(emailSends.fromDomain, fromDomain) : undefined,
    to ? ilike(emailSends.to, `%${to}%`) : undefined,
    dateFrom ? gte(emailSends.createdAt, new Date(dateFrom)) : undefined,
    dateTo ? lte(emailSends.createdAt, new Date(dateTo + 'T23:59:59.999Z')) : undefined,
    status ? eq(emailSends.status, status) : undefined,
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
