import { auth } from '../../lib/auth'
import { db } from '../../db/index'
import { emailIdentities } from '../../db/schema'
import { env } from '../../lib/env'
import { sesv2, identityArn, configSetArn } from '../../lib/sesv2'
import {
  CreateEmailIdentityCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from '@aws-sdk/client-sesv2'
import { z } from 'zod'

const bodySchema = z.object({
  domain: z
    .string()
    .min(1)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Invalid domain',
    ),
  mailFromSubdomain: z.string().min(1).default('mail'),
})

function domainToTenantName(domain: string): string {
  return domain.replace(/\./g, '-')
}

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

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Validation failed', details: parsed.error.flatten() }
  }

  const { domain, mailFromSubdomain } = parsed.data
  const mailFromDomain = `${mailFromSubdomain}.${domain}`

  // Create or accept existing SES identity
  try {
    await sesv2.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }))
  }
  catch (err) {
    if ((err as { name?: string }).name !== 'AlreadyExistsException') throw err
  }

  // Fetch current attributes (DKIM tokens)
  const identity = await sesv2.send(new GetEmailIdentityCommand({ EmailIdentity: domain }))
  const dkimTokens = identity.DkimAttributes?.Tokens ?? []
  const dkimStatus = identity.DkimAttributes?.Status ?? 'PENDING'

  // Configure MAIL FROM domain
  await sesv2.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain,
      BehaviorOnMxFailure: 'USE_DEFAULT_VALUE',
    }),
  )

  // Create SES tenant for this identity (idempotent)
  const tenantName = domainToTenantName(domain)
  try {
    await sesv2.send(new CreateTenantCommand({ TenantName: tenantName }))
  }
  catch (err) {
    if ((err as { name?: string }).name !== 'AlreadyExistsException') throw err
  }

  // Associate identity with tenant
  await sesv2.send(
    new CreateTenantResourceAssociationCommand({
      TenantName: tenantName,
      ResourceArn: await identityArn(domain),
    }),
  ).catch((err: { name?: string }) => {
    if (err.name !== 'AlreadyExistsException') throw err
  })

  // Associate configuration set with tenant (if configured)
  if (env.SES_CONFIGURATION_SET) {
    await sesv2.send(
      new CreateTenantResourceAssociationCommand({
        TenantName: tenantName,
        ResourceArn: await configSetArn(env.SES_CONFIGURATION_SET),
      }),
    ).catch((err: { name?: string }) => {
      if (err.name !== 'AlreadyExistsException') throw err
    })
  }

  // Upsert in DB
  const now = new Date()
  const [row] = await db
    .insert(emailIdentities)
    .values({
      domain,
      status: mapStatus(dkimStatus),
      dkimTokens: dkimTokens.length ? dkimTokens : null,
      dkimStatus,
      mailFromDomain,
      tenantName,
      rawAttributes: identity as unknown as Record<string, unknown>,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: emailIdentities.domain,
      set: {
        status: mapStatus(dkimStatus),
        dkimTokens: dkimTokens.length ? dkimTokens : null,
        dkimStatus,
        mailFromDomain,
        tenantName,
        rawAttributes: identity as unknown as Record<string, unknown>,
        updatedAt: now,
      },
    })
    .returning()

  const dnsRecords = {
    dkim: dkimTokens.map(t => ({
      name: `${t}._domainkey.${domain}`,
      type: 'CNAME',
      value: `${t}.dkim.amazonses.com`,
    })),
    mailFrom: [
      { name: mailFromDomain, type: 'MX', value: `10 feedback-smtp.${env.AWS_REGION}.amazonses.com` },
      { name: mailFromDomain, type: 'TXT', value: `v=spf1 include:amazonses.com ~all` },
    ],
    dmarc: [
      { name: `_dmarc.${domain}`, type: 'TXT', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
    ],
  }

  setResponseStatus(event, 201)
  return { identity: row, dnsRecords }
})
