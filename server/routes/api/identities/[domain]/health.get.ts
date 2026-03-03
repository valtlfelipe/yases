import { auth } from '../../../../lib/auth'
import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
import { sesv2 } from '../../../../lib/sesv2'
import { GetTenantCommand, GetReputationEntityCommand } from '@aws-sdk/client-sesv2'
import { eq } from 'drizzle-orm'

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
    .select({ tenantName: emailIdentities.tenantName })
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)

  const tenantName = rows[0]?.tenantName
  if (!tenantName) {
    return { available: false }
  }

  const tenantRes = await sesv2.send(new GetTenantCommand({ TenantName: tenantName }))
  const tenantArn = tenantRes.Tenant?.TenantArn

  if (!tenantArn) {
    return { available: false }
  }

  const repRes = await sesv2.send(new GetReputationEntityCommand({
    ReputationEntityReference: tenantArn,
    ReputationEntityType: 'RESOURCE',
  }))

  const entity = repRes.ReputationEntity
  return {
    available: true,
    sendingStatus: entity?.SendingStatusAggregate ?? tenantRes.Tenant?.SendingStatus ?? 'ENABLED',
    reputationImpact: entity?.ReputationImpact ?? null,
    awsManagedStatus: entity?.AwsSesManagedStatus?.Status ?? null,
    customerManagedStatus: entity?.CustomerManagedStatus?.Status ?? null,
  }
})
