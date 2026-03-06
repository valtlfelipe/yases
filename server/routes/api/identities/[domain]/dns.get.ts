import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { ProviderService } from '../../../../services/ProviderService'
import { requireApiAuth } from '../../../../utils/requireApiAuth'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const domain = getRouterParam(event, 'domain')!

  const rows = await db
    .select()
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)

  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Identity not found' })

  const { dkimTokens, mailFromDomain, providerId } = rows[0]
  const provider = await providerService.getInstanceById(providerId)

  return provider.getDomainDns({
    domain,
    dkimTokens,
    mailFromDomain,
  })
})
