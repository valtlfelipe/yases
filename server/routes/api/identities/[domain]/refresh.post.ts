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

  let statusData
  try {
    const provider = await providerService.getInstanceById(rows[0].providerId)
    statusData = await provider.getDomainStatus(domain)
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach AWS SES' })
  }

  const raw = (statusData.rawAttributes ?? {}) as {
    dkimTokens?: string[]
    mailFromDomain?: string | null
  }
  const dkimTokens = raw.dkimTokens ?? []
  const mailFromDomain = raw.mailFromDomain ?? rows[0].mailFromDomain

  const [row] = await db
    .update(emailIdentities)
    .set({
      status: statusData.status as 'pending' | 'verified' | 'failed' | 'temporarily_failed',
      dkimTokens: dkimTokens.length ? dkimTokens : rows[0].dkimTokens,
      mailFromDomain,
      rawAttributes: statusData.rawAttributes ?? rows[0].rawAttributes,
      updatedAt: new Date(),
    })
    .where(eq(emailIdentities.domain, domain))
    .returning()

  return { identity: row }
})
