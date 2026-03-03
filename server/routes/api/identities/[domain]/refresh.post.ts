import { auth } from '../../../../lib/auth'
import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
import { sesv2 } from '../../../../lib/sesv2'
import { GetEmailIdentityCommand } from '@aws-sdk/client-sesv2'
import { eq } from 'drizzle-orm'

function mapStatus(
  sesStatus: string | undefined,
): 'pending' | 'verified' | 'failed' | 'temporarily_failed' {
  switch (sesStatus) {
    case 'SUCCESS': return 'verified'
    case 'FAILED': return 'failed'
    case 'TEMPORARY_FAILURE': return 'temporarily_failed'
    default: return 'pending'
  }
}

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

  let awsData
  try {
    awsData = await sesv2.send(new GetEmailIdentityCommand({ EmailIdentity: domain }))
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to reach AWS SES' })
  }

  const dkimTokens = awsData.DkimAttributes?.Tokens ?? []

  const [row] = await db
    .update(emailIdentities)
    .set({
      status: mapStatus(awsData.DkimAttributes?.Status),
      dkimStatus: awsData.DkimAttributes?.Status,
      dkimTokens: dkimTokens.length ? dkimTokens : rows[0].dkimTokens,
      rawAttributes: awsData as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(emailIdentities.domain, domain))
    .returning()

  return { identity: row }
})
