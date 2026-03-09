import { ProviderService } from '../../../services/ProviderService'
import { db } from '../../../db/index'
import { emailIdentities } from '../../../db/schema'
import { requireApiAuth } from '../../../utils/requireApiAuth'
import { and, inArray, isNotNull, sql } from 'drizzle-orm'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const providers = await providerService.list()
  const providerIds = providers.map(p => p.id)

  const domainsByProvider = providerIds.length > 0
    ? await db
        .select({
          providerId: emailIdentities.providerId,
          domainCount: sql<number>`count(*)`,
        })
        .from(emailIdentities)
        .where(and(
          isNotNull(emailIdentities.providerId),
          inArray(emailIdentities.providerId, providerIds),
        ))
        .groupBy(emailIdentities.providerId)
    : []

  const domainCountMap = new Map<string, number>(
    domainsByProvider.map(row => [row.providerId as string, Number(row.domainCount) || 0]),
  )

  // Don't return credentials in list
  return providers.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    isActive: p.isActive,
    settings: p.settings,
    domainCount: domainCountMap.get(p.id) || 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
})
