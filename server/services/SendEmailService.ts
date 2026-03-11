import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index'
import { emailSends, emailIdentities, emailEvents, providers } from '../db/schema'
import { EmailValidationService } from './EmailValidationService'
import { SuppressionService } from './SuppressionService'
import { emailQueue } from '../queue/index'
import { extractEmail, isValidEmailField } from '../utils/email'
import { signUnsubscribeToken } from '../lib/unsubscribeToken'
import { env } from '../lib/env'

const emailField = z.string().refine(isValidEmailField, 'Invalid email address')

export const sendEmailSchema = z
  .object({
    to: emailField.describe('Recipient email address (e.g., "user@example.com" or "User <user@example.com>")'),
    from: emailField.describe('Sender email address (must be a verified identity, e.g., "Sender <noreply@yourdomain.com>")'),
    subject: z.string().min(1).describe('Email subject line'),
    html: z.string().optional().describe('HTML email body'),
    text: z.string().optional().describe('Plain text email body'),
    replyTo: emailField.optional().describe('Reply-to address'),
    type: z.enum(['transactional', 'marketing']).default('transactional').describe('Email type: "transactional" or "marketing"'),
  })
  .refine(d => d.html || d.text, { message: 'html or text is required' })

export type SendEmailInput = z.infer<typeof sendEmailSchema>

export interface SendEmailParams {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  type?: 'transactional' | 'marketing'
}

export interface SendEmailResult {
  id: string
  status: 'queued' | 'suppressed'
  reason?: string
}

export class SendEmailError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'SendEmailError'
  }
}

async function getIdentity(fromAddress: string) {
  const domain = extractEmail(fromAddress).split('@')[1]!
  const rows = await db
    .select({
      status: emailIdentities.status,
      tenantName: emailIdentities.tenantName,
      providerId: emailIdentities.providerId,
      providerType: providers.name,
    })
    .from(emailIdentities)
    .leftJoin(providers, eq(emailIdentities.providerId, providers.id))
    .where(eq(emailIdentities.domain, domain))
    .limit(1)
  return rows[0] ?? null
}

const validationService = new EmailValidationService()
const suppressionService = new SuppressionService()

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, from, subject, html, text, replyTo, type = 'transactional' } = params

  const toEmail = extractEmail(to)
  const fromEmail = extractEmail(from)
  const fromDomain = from.split('@')[1] ?? null

  if (type === 'marketing') {
    const hasPlaceholder = html?.includes('{{unsubscribeUrl}}') || text?.includes('{{unsubscribeUrl}}')
    if (!hasPlaceholder) {
      throw new SendEmailError(
        'Marketing emails must include {{unsubscribeUrl}} placeholder in html or text body',
        'MISSING_UNSUBSCRIBE_URL',
      )
    }
  }

  const identity = await getIdentity(fromEmail)
  if (identity?.status !== 'verified') {
    throw new SendEmailError(
      `Domain of '${fromEmail}' is not a verified sending identity`,
      'UNVERIFIED_IDENTITY',
    )
  }

  const validation = await validationService.validate(toEmail)
  if (!validation.valid) {
    throw new SendEmailError(
      validation.detail || validation.reason || 'Invalid email',
      'INVALID_EMAIL',
    )
  }

  const suppression = await suppressionService.isSuppressed(toEmail)
  const isBlocked = suppression && (type === 'marketing' || suppression.reason !== 'unsubscribed')

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
      status: isBlocked ? 'suppressed' : 'queued',
      providerId: identity?.providerId ?? null,
      providerType: identity?.providerType ?? null,
    })
    .returning()

  if (!send) {
    throw new SendEmailError('Failed to create email send record', 'INTERNAL_ERROR', 500)
  }

  await db.insert(emailEvents).values({
    emailSendId: send.id,
    eventType: 'queued',
    providerId: identity?.providerId ?? null,
    providerType: identity?.providerType ?? null,
    rawPayload: {},
    occurredAt: send.createdAt,
  })

  if (isBlocked) {
    await db.insert(emailEvents).values({
      emailSendId: send.id,
      providerId: identity?.providerId ?? null,
      providerType: identity?.providerType ?? null,
      eventType: 'suppressed',
      rawPayload: { reason: suppression.reason },
      metadata: { reason: suppression.reason },
      occurredAt: send.updatedAt,
    })

    return { id: send.id, status: 'suppressed', reason: suppression.reason }
  }

  let unsubscribeUrl: string | undefined
  let updatedHtml = html
  let updatedText = text

  if (type === 'marketing') {
    const token = signUnsubscribeToken(toEmail, env.TOKEN_SECRET, send.id)
    unsubscribeUrl = `${env.BETTER_AUTH_URL}/unsubscribe?token=${token}`
    updatedHtml = html?.replaceAll('{{unsubscribeUrl}}', unsubscribeUrl)
    updatedText = text?.replaceAll('{{unsubscribeUrl}}', unsubscribeUrl)
    await db
      .update(emailSends)
      .set({ htmlBody: updatedHtml ?? null, textBody: updatedText ?? null })
      .where(eq(emailSends.id, send.id))
  }

  const job = await emailQueue.add(
    'send',
    {
      emailSendId: send.id,
      to,
      from,
      subject,
      html: updatedHtml,
      text: updatedText,
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

  return { id: send.id, status: 'queued' }
}
