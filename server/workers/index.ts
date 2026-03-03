import '../lib/env'
import { createEmailWorker } from './emailWorker'
import { createWebhookWorker } from './webhookWorker'

const emailWorker = createEmailWorker()
const webhookWorker = createWebhookWorker()

console.log('[Worker] Email worker started')
console.log('[Worker] Webhook worker started')

async function shutdown() {
  await Promise.all([emailWorker.close(), webhookWorker.close()])
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
