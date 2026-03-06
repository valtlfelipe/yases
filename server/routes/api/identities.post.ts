import { db } from '../../db/index'
import { emailIdentities } from '../../db/schema'
import { z } from 'zod'
import { ProviderService } from '../../services/ProviderService'
import { requireApiAuth } from '../../utils/requireApiAuth'

const providerService = new ProviderService()

const bodySchema = z.object({
  domain: z
    .string()
    .min(1)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Invalid domain',
    ),
  mailFromSubdomain: z.string().min(1).default('mail'),
  providerId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Validation failed', details: parsed.error.flatten() }
  }

  const { domain, mailFromSubdomain, providerId } = parsed.data
  const provider = await providerService.getById(providerId)

  if (!provider) {
    throw createError({ statusCode: 400, statusMessage: 'Selected provider was not found' })
  }

  const setupResult = await providerService.setupDomain(providerId, { domain, mailFromSubdomain })

  // Upsert in DB
  const now = new Date()
  const [row] = await db
    .insert(emailIdentities)
    .values({
      domain,
      status: setupResult.status,
      dkimTokens: setupResult.dkimTokens.length ? setupResult.dkimTokens : null,
      mailFromDomain: setupResult.mailFromDomain,
      tenantName: setupResult.tenantName,
      providerId,
      rawAttributes: setupResult.rawAttributes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: emailIdentities.domain,
      set: {
        status: setupResult.status,
        dkimTokens: setupResult.dkimTokens.length ? setupResult.dkimTokens : null,
        mailFromDomain: setupResult.mailFromDomain,
        tenantName: setupResult.tenantName,
        providerId,
        rawAttributes: setupResult.rawAttributes,
        updatedAt: now,
      },
    })
    .returning()

  setResponseStatus(event, 201)
  return { identity: row, dnsRecords: setupResult.dnsRecords }
})
