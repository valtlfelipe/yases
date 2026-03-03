import { Worker, type Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { emailSends, emailEvents } from '../db/schema.ts'
import { SuppressionService } from '../services/SuppressionService.ts'
import { SESService } from '../services/SESService.ts'
import { QUEUE_NAME } from '../queue/index.ts'
import type { EmailJobData } from '../queue/types.ts'
import { env } from '../lib/env.ts'
import { bullMQConnection } from '../queue/connection.ts'
import { extractEmail } from '../utils/email.ts'

const PERMANENT_SES_ERRORS = new Set([
  'MessageRejected',
  'InvalidParameterValue',
  'InvalidParameterCombination',
  'MailFromDomainNotVerified',
  'EmailAddressNotVerifiedException',
])

const suppressionService = new SuppressionService()
const sesService = new SESService()

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailSendId, to, from, subject, html, text, replyTo } = job.data

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
    const { sesMessageId } = await sesService.send({ to, from, subject, html, text, replyTo })

    await db
      .update(emailSends)
      .set({
        status: 'sent',
        sesMessageId,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailSends.id, emailSendId))

    await db.insert(emailEvents).values({
      emailSendId,
      sesMessageId,
      eventType: 'submitted',
      rawPayload: { jobId: job.id, to, from, subject },
      occurredAt: new Date(),
    })

    console.log(`[Worker] Job ${job.id}: sent (${sesMessageId}) to ${to}`)
  }
  catch (err: unknown) {
    const error = err as { name?: string, message?: string }
    const errorName = error.name ?? ''
    const errorMessage = error.message ?? String(err)

    if (PERMANENT_SES_ERRORS.has(errorName)) {
      await db
        .update(emailSends)
        .set({
          status: 'failed',
          lastError: `${errorName}: ${errorMessage}`,
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
