import { eq } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends, emailIdentities, emailEvents } from '../../../db/schema'
import { EmailValidationService } from '../../../services/EmailValidationService'
import { SuppressionService } from '../../../services/SuppressionService'
import { emailQueue } from '../../../queue/index'
import { extractEmail, isValidEmailField } from '../../../utils/email'
import { requireApiAuth } from '../../../utils/requireApiAuth'
import { signUnsubscribeToken } from '../../../lib/unsubscribeToken'
import { env } from '../../../lib/env'
import { z } from 'zod'

const emailField = z.string().refine(isValidEmailField, 'Invalid email address')

const sendSchema = z
  .object({
    to: emailField,
    from: emailField,
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
    replyTo: emailField.optional(),
    type: z.enum(['transactional', 'marketing']).default('transactional'),
  })
  .refine(d => d.html || d.text, { message: 'html or text is required' })

async function getIdentity(fromAddress: string) {
  const domain = extractEmail(fromAddress).split('@')[1]!
  const rows = await db
    .select({ status: emailIdentities.status, tenantName: emailIdentities.tenantName, providerId: emailIdentities.providerId })
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)
  return rows[0] ?? null
}

const validationService = new EmailValidationService()
const suppressionService = new SuppressionService()

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const body = await readBody(event)
  const parsed = sendSchema.safeParse(body)

  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Validation failed', details: parsed.error.flatten() }
  }

  const { to, from, subject, replyTo } = parsed.data
  let { html, text } = parsed.data
  const { type } = parsed.data
  let unsubscribeUrl: string | undefined
  const toEmail = extractEmail(to)
  const fromEmail = extractEmail(from)

  if (type === 'marketing') {
    const hasPlaceholder = html?.includes('{{unsubscribeUrl}}') || text?.includes('{{unsubscribeUrl}}')
    if (!hasPlaceholder) {
      setResponseStatus(event, 400)
      return {
        error: 'MISSING_UNSUBSCRIBE_URL',
        detail: 'Marketing emails must include {{unsubscribeUrl}} placeholder in html or text body',
      }
    }
  }

  const identity = await getIdentity(fromEmail)
  if (identity?.status !== 'verified') {
    setResponseStatus(event, 400)
    return {
      error: 'UNVERIFIED_IDENTITY',
      detail: `Domain of '${fromEmail}' is not a verified sending identity`,
    }
  }

  const validation = await validationService.validate(toEmail)
  if (!validation.valid) {
    setResponseStatus(event, 400)
    return {
      error: 'INVALID_EMAIL',
      reason: validation.reason,
      detail: validation.detail,
    }
  }

  const suppression = await suppressionService.isSuppressed(toEmail)
  const fromDomain = extractEmail(from).split('@')[1] ?? null

  // Transactional emails bypass unsubscribe suppression; all other reasons still block
  const isBlocked = suppression && (type === 'marketing' || suppression.reason !== 'unsubscribed')

  if (isBlocked) {
    const [send] = await db
      .insert(emailSends)
      .values({
        to,
        from,
        fromDomain,
        subject,
        htmlBody: html ?? null,
        textBody: text ?? null,
        replyTo: replyTo ?? null,
        status: 'suppressed',
      })
      .returning()

    if (!send) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create email send record' })
    }

    await db.insert(emailEvents).values([
      { emailSendId: send.id, eventType: 'queued', rawPayload: {}, occurredAt: send.createdAt },
      { emailSendId: send.id, eventType: 'suppressed', rawPayload: { reason: suppression.reason }, metadata: { reason: suppression.reason }, occurredAt: send.updatedAt },
    ])

    setResponseStatus(event, 202)
    return { id: send.id, status: 'suppressed', reason: suppression.reason }
  }

  const [send] = await db
    .insert(emailSends)
    .values({
      to,
      from,
      fromDomain,
      subject,
      htmlBody: html ?? null,
      textBody: text ?? null,
      replyTo: replyTo ?? null,
      status: 'queued',
    })
    .returning()

  if (!send) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create email send record' })
  }

  // Now that we have send.id, regenerate the unsubscribe URL with it embedded in the token
  if (type === 'marketing') {
    const token = signUnsubscribeToken(toEmail, env.TOKEN_SECRET, send.id)
    unsubscribeUrl = `${env.BETTER_AUTH_URL}/unsubscribe?token=${token}`
    html = html?.replaceAll('{{unsubscribeUrl}}', unsubscribeUrl)
    text = text?.replaceAll('{{unsubscribeUrl}}', unsubscribeUrl)
    await db.update(emailSends).set({ htmlBody: html ?? null, textBody: text ?? null }).where(eq(emailSends.id, send.id))
  }

  await db.insert(emailEvents).values({
    emailSendId: send.id,
    eventType: 'queued',
    rawPayload: {},
    occurredAt: send.createdAt,
  })

  const job = await emailQueue.add(
    'send',
    {
      emailSendId: send.id,
      to,
      from,
      subject,
      html,
      text,
      replyTo,
      tenantName: identity?.tenantName ?? undefined,
      unsubscribeUrl,
      enqueuedAt: new Date().toISOString(),
      providerId: identity?.providerId ?? undefined,
    },
    { jobId: send.id },
  )

  await db
    .update(emailSends)
    .set({ jobId: job.id ?? null })
    .where(eq(emailSends.id, send.id))

  setResponseStatus(event, 202)
  return { id: send.id, status: 'queued' }
})
