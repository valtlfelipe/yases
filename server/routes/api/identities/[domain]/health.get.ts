import { auth } from '../../../../lib/auth'
import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { ProviderService } from '../../../../services/ProviderService'

const providerService = new ProviderService()

export default defineEventHandler(async (event) => {
  const headers = event.headers
  let session = await auth.api.getSession({ headers }).catch(() => null)

  if (!session) {
    const apiKey = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (apiKey) {
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
      if (!result.valid) throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
      // @ts-expect-error - API key authentication creates a minimal session object
      session = { user: result.key, session: null }
    }
  }

  if (!session) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

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
