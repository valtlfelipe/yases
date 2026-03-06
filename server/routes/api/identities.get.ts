import { desc, count, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { emailIdentities, providers } from '../../db/schema'
import { requireApiAuth } from '../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = (page - 1) * limit

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: emailIdentities.id,
        domain: emailIdentities.domain,
        status: emailIdentities.status,
        dkimTokens: emailIdentities.dkimTokens,
        mailFromDomain: emailIdentities.mailFromDomain,
        tenantName: emailIdentities.tenantName,
        rawAttributes: emailIdentities.rawAttributes,
        providerId: emailIdentities.providerId,
        createdAt: emailIdentities.createdAt,
        updatedAt: emailIdentities.updatedAt,
        providerName: providers.name,
        providerDisplayName: providers.displayName,
      })
      .from(emailIdentities)
      .leftJoin(providers, eq(emailIdentities.providerId, providers.id))
      .orderBy(desc(emailIdentities.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(emailIdentities),
  ])

  return {
    items,
    total: countResult[0]?.total ?? 0,
    page,
    limit,
  }
})
