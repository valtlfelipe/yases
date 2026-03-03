import { auth } from '../../../lib/auth'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends, emailIdentities } from '../../../db/schema'
import { EmailValidationService } from '../../../services/EmailValidationService'
import { SuppressionService } from '../../../services/SuppressionService'
import { emailQueue } from '../../../queue/index'
import { extractEmail, isValidEmailField } from '../../../utils/email'
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
  })
  .refine(d => d.html || d.text, { message: 'html or text is required' })

async function getIdentity(fromAddress: string) {
  const domain = extractEmail(fromAddress).split('@')[1]!
  const rows = await db
    .select({ status: emailIdentities.status, tenantName: emailIdentities.tenantName })
    .from(emailIdentities)
    .where(eq(emailIdentities.domain, domain))
    .limit(1)
  return rows[0] ?? null
}

const validationService = new EmailValidationService()
const suppressionService = new SuppressionService()

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

export default defineEventHandler(async (event) => {
  const headers = event.headers

  let session: Session | null = await auth.api.getSession({ headers }).catch(() => null)

  if (!session) {
    const apiKey = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (apiKey) {
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
      if (!result.valid) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
      }
      session = { user: result.key, session: null } as unknown as Session
    }
  }

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const parsed = sendSchema.safeParse(body)

  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { error: 'Validation failed', details: parsed.error.flatten() }
  }

  const { to, from, subject, html, text, replyTo } = parsed.data
  const toEmail = extractEmail(to)
  const fromEmail = extractEmail(from)

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
  if (suppression) {
    setResponseStatus(event, 400)
    return { error: 'SUPPRESSED', reason: suppression.reason }
  }

  const [send] = await db
    .insert(emailSends)
    .values({
      to,
      from,
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
      tenantName: identity.tenantName ?? undefined,
      enqueuedAt: new Date().toISOString(),
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
