import { and, desc, eq, ilike } from 'drizzle-orm'
import { db } from '../db/index'
import { suppressionList } from '../db/schema'
import { redis } from '../cache/redis'

type SuppressionReason
  = | 'permanent_bounce'
    | 'transient_bounce'
    | 'complaint'
    | 'invalid'
    | 'manual'

const CACHE_PREFIX = 'suppression:email:'
const CACHE_TTL_SECONDS = 3600 // 1h

interface SuppressionEntry {
  reason: SuppressionReason
  detail?: string | null
}

export class SuppressionService {
  async isSuppressed(email: string): Promise<SuppressionEntry | null> {
    const lower = email.toLowerCase()
    const cacheKey = `${CACHE_PREFIX}${lower}`

    const cached = await redis.get(cacheKey)
    if (cached !== null) {
      return cached === 'false' ? null : (JSON.parse(cached) as SuppressionEntry)
    }

    const row = await db
      .select()
      .from(suppressionList)
      .where(eq(suppressionList.email, lower))
      .limit(1)

    if (row.length === 0) {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, 'false')
      return null
    }

    const entry: SuppressionEntry = { reason: row[0]!.reason, detail: row[0]!.detail }
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(entry))
    return entry
  }

  async add(email: string, reason: SuppressionReason, detail?: string): Promise<void> {
    const lower = email.toLowerCase()
    const now = new Date()

    await db
      .insert(suppressionList)
      .values({ email: lower, reason, detail: detail ?? null, updatedAt: now })
      .onConflictDoUpdate({
        target: suppressionList.email,
        set: { reason, detail: detail ?? null, updatedAt: now },
      })

    await redis.del(`${CACHE_PREFIX}${lower}`)
  }

  async remove(email: string): Promise<boolean> {
    const lower = email.toLowerCase()

    const deleted = await db
      .delete(suppressionList)
      .where(eq(suppressionList.email, lower))
      .returning()

    await redis.del(`${CACHE_PREFIX}${lower}`)
    return deleted.length > 0
  }

  async list(
    page: number,
    limit: number,
    reason?: SuppressionReason,
    email?: string,
  ): Promise<{ items: typeof suppressionList.$inferSelect[], total: number }> {
    const offset = (page - 1) * limit

    const conditions = [
      reason ? eq(suppressionList.reason, reason) : undefined,
      email ? ilike(suppressionList.email, `%${email}%`) : undefined,
    ].filter(Boolean)

    const where = conditions.length > 1 ? and(...conditions) : conditions[0]

    const [items, countRows] = await Promise.all([
      where
        ? db.select().from(suppressionList).where(where).orderBy(desc(suppressionList.createdAt)).limit(limit).offset(offset)
        : db.select().from(suppressionList).orderBy(desc(suppressionList.createdAt)).limit(limit).offset(offset),
      where
        ? db.select({ id: suppressionList.id }).from(suppressionList).where(where)
        : db.select({ id: suppressionList.id }).from(suppressionList),
    ])

    return { items, total: countRows.length }
  }
}
