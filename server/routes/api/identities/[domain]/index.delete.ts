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

  await providerService.deleteDomain(rows[0].providerId, {
    domain,
    tenantName: rows[0].tenantName,
  })

  await db.delete(emailIdentities).where(eq(emailIdentities.domain, domain))

  setResponseStatus(event, 204)
  return null
})
