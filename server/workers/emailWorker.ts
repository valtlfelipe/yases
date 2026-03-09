import { Worker, type Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { emailSends, emailEvents } from '../db/schema'
import { SuppressionService } from '../services/SuppressionService'
import { EmailService, ProviderSendError } from '../services/EmailService'
import { QUEUE_NAME } from '../queue/index'
import type { EmailJobData } from '../queue/types'
import { env } from '../lib/env'
import { bullMQConnection } from '../queue/connection'
import { extractEmail } from '../utils/email'

const suppressionService = new SuppressionService()
const emailService = new EmailService()

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const {
    emailSendId,
    to,
    from,
    subject,
    html,
    text,
    replyTo,
    unsubscribeUrl,
    providerId,
  } = job.data

  await db
    .update(emailSends)
    .set({
      status: 'sending',
      attempts: job.attemptsMade + 1,
      updatedAt: new Date(),
    })
    .where(eq(emailSends.id, emailSendId))

  const suppressed = await suppressionService.isSuppressed(extractEmail(to))
  if (suppressed) {
    await db
      .update(emailSends)
      .set({
        status: 'suppressed',
        lastError: `Suppressed: ${suppressed.reason}`,
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, emailSendId))
    console.log(`[Worker] Job ${job.id}: suppressed (${suppressed.reason}) for ${to}`)
    return
  }

  try {
    const { providerMessageId, providerId: resolvedProviderId, providerType } = await emailService.send({
      to,
      from,
      subject,
      html,
      text,
      replyTo,
      unsubscribeUrl,
      providerId,
    })

    await db
      .update(emailSends)
      .set({
        status: 'sent',
        providerMessageId,
        providerId: resolvedProviderId,
        providerType,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, emailSendId))

    await db.insert(emailEvents).values({
      emailSendId,
      providerMessageId,
      providerId: resolvedProviderId,
      providerType,
      eventType: 'submitted',
      rawPayload: { jobId: job.id, to, from, subject },
      occurredAt: new Date(),
    })

    console.log(`[Worker] Job ${job.id}: sent (${providerMessageId}) to ${to}`)
  }
  catch (err: unknown) {
    const error = err as { name?: string, message?: string }
    const errorName = error.name ?? ''
    const errorMessage = error.message ?? String(err)
    const providerError = err instanceof ProviderSendError ? err : null

    if (providerError?.permanent) {
      await db
        .update(emailSends)
        .set({
          status: 'failed',
          lastError: `${errorName}: ${errorMessage}`,
          providerId: providerError.providerId,
          providerType: providerError.providerType,
          updatedAt: new Date(),
        })
        .where(eq(emailSends.id, emailSendId))
      console.error(`[Worker] Job ${job.id}: permanent failure (${errorName}) for ${to}`)
      return
    }

    await db
      .update(emailSends)
      .set({
        lastError: `${errorName}: ${errorMessage}`,
        providerId: providerError?.providerId ?? providerId ?? null,
        providerType: providerError?.providerType ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, emailSendId))

    console.error(`[Worker] Job ${job.id}: transient error, will retry: ${errorMessage}`)
    throw err
  }
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: bullMQConnection(),
    concurrency: env.EMAIL_QUEUE_CONCURRENCY,
    limiter: {
      max: 50,
      duration: 1000,
    },
  })

  worker.on('failed', async (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed after all attempts:`, err.message)
    if (job?.data.emailSendId) {
      await db
        .update(emailSends)
        .set({ status: 'failed', lastError: err.message, updatedAt: new Date() })
        .where(eq(emailSends.id, job.data.emailSendId))
    }
  })

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message)
  })

  return worker
}
