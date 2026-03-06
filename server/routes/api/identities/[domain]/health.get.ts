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
    .select({ tenantName: emailIdentities.tenantName, providerId: emailIdentities.providerId })
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)

  const tenantName = rows[0]?.tenantName
  if (!tenantName) {
    return { available: false }
  }

  try {
    const provider = await providerService.getInstanceById(rows[0]?.providerId)
    return await provider.getDomainHealth(tenantName)
  }
  catch {
    return { available: false }
  }
})
