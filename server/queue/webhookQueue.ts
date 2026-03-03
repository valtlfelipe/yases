import { Queue } from 'bullmq'
import { bullMQConnection } from './connection.ts'
import type { WebhookJobData } from './types.ts'

export const WEBHOOK_QUEUE_NAME = 'webhook-process'

export const webhookQueue = new Queue<WebhookJobData, void, string>(WEBHOOK_QUEUE_NAME, {
  connection: bullMQConnection(),
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
})
