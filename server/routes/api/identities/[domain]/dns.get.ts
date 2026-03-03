import { auth } from '../../../../lib/auth'
import { db } from '../../../../db/index'
import { emailIdentities } from '../../../../db/schema'
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

  const { dkimTokens, mailFromDomain } = rows[0]

  return {
    dkim: (dkimTokens ?? []).map(t => ({
      name: `${t}._domainkey.${domain}`,
      type: 'CNAME',
      value: `${t}.dkim.amazonses.com`,
    })),
    mailFrom: mailFromDomain
      ? [
          { name: mailFromDomain, type: 'MX', value: `10 feedback-smtp.${env.AWS_REGION}.amazonses.com` },
          { name: mailFromDomain, type: 'TXT', value: `v=spf1 include:amazonses.com ~all` },
        ]
      : [],
    dmarc: [
      { name: `_dmarc.${domain}`, type: 'TXT', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
    ],
  }
})
