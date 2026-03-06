import { auth } from '../../lib/auth'
import { desc, count, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { emailIdentities, providers } from '../../db/schema'

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
