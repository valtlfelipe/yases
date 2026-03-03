import { auth } from '../../../../lib/auth'
import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
import { sesv2, identityArn, configSetArn } from '../../../../lib/sesv2'
import { DeleteEmailIdentityCommand, DeleteTenantCommand, DeleteTenantResourceAssociationCommand } from '@aws-sdk/client-sesv2'
import { env } from '../../../../lib/env'
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
    .select()
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)

  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Identity not found' })

  const { tenantName } = rows[0]

  // Remove tenant associations and tenant before deleting the identity
  if (tenantName) {
    const ignore = (err: unknown) => {
      if ((err as { name?: string }).name !== 'NotFoundException') throw err
    }

    // Dissociate config set from tenant (if configured)
    if (env.SES_CONFIGURATION_SET) {
      await sesv2.send(new DeleteTenantResourceAssociationCommand({
        TenantName: tenantName,
        ResourceArn: await configSetArn(env.SES_CONFIGURATION_SET),
      })).catch(ignore)
    }

    // Dissociate identity from tenant
    await sesv2.send(new DeleteTenantResourceAssociationCommand({
      TenantName: tenantName,
      ResourceArn: await identityArn(domain),
    })).catch(ignore)

    // Delete the tenant
    await sesv2.send(new DeleteTenantCommand({ TenantName: tenantName })).catch(ignore)
  }

  // Remove identity from SES (ignore if already gone)
  try {
    await sesv2.send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }))
  }
  catch (err) {
    if ((err as { name?: string }).name !== 'NotFoundException') throw err
  }

  await db.delete(emailIdentities).where(eq(emailIdentities.domain, domain))

  setResponseStatus(event, 204)
  return null
})
