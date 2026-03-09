import { Worker, type Job } from 'bullmq'
import { and, eq, or, isNull } from 'drizzle-orm'
import { db } from '../db/index'
import { emailEvents, emailSends } from '../db/schema'
import { SuppressionService } from '../services/SuppressionService'
import { WEBHOOK_QUEUE_NAME } from '../queue/webhookQueue'
import { bullMQConnection } from '../queue/connection'
import type { WebhookJobData } from '../queue/types'
import type { ProviderType } from '../lib/providers'

const suppressionService = new SuppressionService()

async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { provider, providerId, event, rawPayload } = job.data
  const eventType = event.eventType.toLowerCase()
  const providerMessageId = event.messageId ?? ''
  console.log(`[WebhookWorker] Processing ${provider}:${eventType} | providerMessageId: ${providerMessageId || '(none)'} | attempt: ${job.attemptsMade + 1}`)

  switch (eventType) {
    case 'send':
      return handleSend(provider, providerId, event, rawPayload)
    case 'bounce':
      return handleBounce(provider, providerId, event, rawPayload)
    case 'complaint':
      return handleComplaint(provider, providerId, event, rawPayload)
    case 'delivery':
      return handleDelivery(provider, providerId, event, rawPayload)
    case 'open':
      return handleOpen(provider, providerId, event, rawPayload)
    case 'click':
      return handleClick(provider, providerId, event, rawPayload)
    default:
      console.warn(`[WebhookWorker] Unhandled notification type: ${provider}:${eventType}`)
      return handleGeneric(provider, providerId, event, rawPayload)
  }
}

async function handleSend(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const sendRow = await requireSendByMessageId(event.messageId ?? '', providerType, providerId)
  await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, event.messageId ?? '', 'send', rawPayload, event.metadata ?? {})
}

async function handleBounce(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const providerMessageId = event.messageId ?? ''
  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)

  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const bounce = (metadata['bounce'] ?? {}) as Record<string, unknown>
  const bounceType = (bounce['bounceType'] as string | undefined)?.toLowerCase()
  const reason = bounceType === 'permanent' ? 'permanent_bounce' : 'transient_bounce'
  const recipients = extractRecipients(event, 'bounce')

  await db.update(emailSends).set({ status: 'bounced', updatedAt: new Date() }).where(eq(emailSends.id, sendRow.id))

  await Promise.all(
    recipients.map(async (recipient) => {
      await suppressionService.add(recipient, reason, bounce['bounceSubType'] as string | undefined)
      await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, 'bounce', rawPayload, {
        bounceType: bounce['bounceType'],
        bounceSubType: bounce['bounceSubType'],
        recipient,
      })
    }),
  )
}

async function handleComplaint(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const providerMessageId = event.messageId ?? ''
  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)
  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const complaint = (metadata['complaint'] ?? {}) as Record<string, unknown>
  const recipients = extractRecipients(event, 'complaint')

  await db.update(emailSends).set({ status: 'complained', updatedAt: new Date() }).where(eq(emailSends.id, sendRow.id))

  await Promise.all(
    recipients.map(async (recipient) => {
      await suppressionService.add(recipient, 'complaint')
      await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, 'complaint', rawPayload, {
        feedbackType: complaint['complaintFeedbackType'],
        recipient,
      })
    }),
  )
}

async function handleDelivery(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const providerMessageId = event.messageId ?? ''
  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)
  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const delivery = (metadata['delivery'] ?? {}) as Record<string, unknown>

  await db.update(emailSends).set({ status: 'delivered', updatedAt: new Date() }).where(eq(emailSends.id, sendRow.id))

  await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, 'delivery', rawPayload, {
    smtpResponse: delivery['smtpResponse'],
    remoteMtaIp: delivery['remoteMtaIp'],
    processingMs: delivery['processingTimeMillis'],
  })
}

async function handleOpen(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const open = (metadata['open'] ?? {}) as Record<string, unknown>
  const mail = (metadata['mail'] ?? {}) as Record<string, unknown>
  const userAgent = open['userAgent'] as string | undefined
  const ipAddress = open['ipAddress'] as string | undefined
  const openedAt = open['timestamp'] as string | undefined
  const sentAt = mail['timestamp'] as string | undefined

  if (isBotOpen(userAgent, ipAddress, openedAt, sentAt)) {
    console.log(`[WebhookWorker] Skipping bot open — IP: ${ipAddress}, UA: ${userAgent}, delta: ${openedAt && sentAt ? `${new Date(openedAt).getTime() - new Date(sentAt).getTime()}ms` : 'unknown'}`)
    return
  }

  const providerMessageId = event.messageId ?? ''
  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)
  await db.update(emailSends).set({ status: 'opened', updatedAt: new Date() }).where(eq(emailSends.id, sendRow.id))
  await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, 'open', rawPayload, { ipAddress, userAgent })
}

async function handleClick(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const providerMessageId = event.messageId ?? ''
  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)
  const metadata = (event.metadata ?? {}) as Record<string, unknown>
  const click = (metadata['click'] ?? {}) as Record<string, unknown>

  await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, 'click', rawPayload, {
    link: click['link'],
    ipAddress: click['ipAddress'],
    userAgent: click['userAgent'],
  })
}

async function handleGeneric(providerType: ProviderType, providerId: string | undefined, event: WebhookJobData['event'], rawPayload: Record<string, unknown>): Promise<void> {
  const providerMessageId = event.messageId ?? ''
  if (!providerMessageId) {
    return
  }

  const sendRow = await requireSendByMessageId(providerMessageId, providerType, providerId)
  const eventType = toEmailEventType(event.eventType)
  if (!eventType) {
    console.warn(`[WebhookWorker] Unsupported generic event type: ${event.eventType}`)
    return
  }
  await insertEvent(sendRow.id, sendRow.providerId ?? null, sendRow.providerType ?? null, providerMessageId, eventType, rawPayload, event.metadata ?? {})
}

const GOOGLE_IP_CIDRS: [number, number][] = [
  [ip2int('66.249.0.0'), 16],
  [ip2int('74.125.0.0'), 16],
  [ip2int('66.102.0.0'), 20],
  [ip2int('64.233.160.0'), 19],
  [ip2int('72.14.192.0'), 18],
  [ip2int('209.85.128.0'), 17],
  [ip2int('216.239.32.0'), 19],
]

const BOT_UA_PATTERNS = [
  'googleimageproxy',
  'googlebot',
  'apple mail privacy protection',
  'yahoomailproxy',
  'outlooksafelink',
  'barracuda',
  'claudebot',
  'gptbot',
]

function ip2int(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet), 0) >>> 0
}

function isGoogleIp(ip: string): boolean {
  try {
    const ipInt = ip2int(ip)
    return GOOGLE_IP_CIDRS.some(([network, prefix]) => {
      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
      return (ipInt & mask) === (network & mask)
    })
  }
  catch {
    return false
  }
}

const BOT_OPEN_TIMING_THRESHOLD_MS = 5_000

function isBotOpen(userAgent?: string, ipAddress?: string, openedAt?: string, sentAt?: string): boolean {
  if (openedAt && sentAt) {
    const delta = new Date(openedAt).getTime() - new Date(sentAt).getTime()
    if (delta >= 0 && delta < BOT_OPEN_TIMING_THRESHOLD_MS) return true
  }

  if (userAgent) {
    const ua = userAgent.toLowerCase()
    if (userAgent.trim() === 'Mozilla/5.0') return true
    if (BOT_UA_PATTERNS.some(p => ua.includes(p))) return true
  }

  if (ipAddress && isGoogleIp(ipAddress)) return true

  return false
}

function extractRecipients(event: WebhookJobData['event'], mode: 'bounce' | 'complaint'): string[] {
  const recipients = new Set<string>()

  if (event.recipient) {
    recipients.add(event.recipient)
  }

  const metadata = (event.metadata ?? {}) as Record<string, unknown>

  if (mode === 'bounce') {
    const bounce = (metadata['bounce'] ?? {}) as Record<string, unknown>
    const bouncedRecipients = (bounce['bouncedRecipients'] as Array<Record<string, unknown>> | undefined) ?? []
    for (const recipient of bouncedRecipients) {
      const email = recipient['emailAddress'] as string | undefined
      if (email) recipients.add(email)
    }
  }
  else {
    const complaint = (metadata['complaint'] ?? {}) as Record<string, unknown>
    const complainedRecipients = (complaint['complainedRecipients'] as Array<Record<string, unknown>> | undefined) ?? []
    for (const recipient of complainedRecipients) {
      const email = recipient['emailAddress'] as string | undefined
      if (email) recipients.add(email)
    }
  }

  return [...recipients]
}

function toEmailEventType(eventType: string): typeof emailEvents.$inferInsert['eventType'] | null {
  const normalized = eventType.toLowerCase()
  const allowed = new Set<typeof emailEvents.$inferInsert['eventType']>([
    'queued',
    'suppressed',
    'submitted',
    'send',
    'delivery',
    'bounce',
    'complaint',
    'reject',
    'open',
    'click',
    'unsubscribe',
  ])

  if (allowed.has(normalized as typeof emailEvents.$inferInsert['eventType'])) {
    return normalized as typeof emailEvents.$inferInsert['eventType']
  }

  return null
}

async function requireSendByMessageId(providerMessageId: string, providerType?: string, providerId?: string) {
  if (!providerMessageId) throw new Error('Empty providerMessageId in notification')

  const scopedRows = providerId
    ? await db
        .select()
        .from(emailSends)
        .where(and(
          eq(emailSends.providerMessageId, providerMessageId),
          eq(emailSends.providerId, providerId),
        ))
        .limit(1)
    : providerType
      ? await db
          .select()
          .from(emailSends)
          .where(and(
            eq(emailSends.providerMessageId, providerMessageId),
            or(
              eq(emailSends.providerType, providerType),
              isNull(emailSends.providerType),
            ),
          ))
          .limit(1)
      : await db
          .select()
          .from(emailSends)
          .where(eq(emailSends.providerMessageId, providerMessageId))
          .limit(1)
  const rows = scopedRows

  if (!rows[0]) {
    console.warn(`[WebhookWorker] No send record found for providerMessageId: ${providerMessageId} — will retry`)
    throw new Error(`Send record not found for providerMessageId: ${providerMessageId}`)
  }

  console.log(`[WebhookWorker] Matched send record ${rows[0].id} (status: ${rows[0].status})`)
  return rows[0]
}

async function insertEvent(
  emailSendId: string,
  providerId: string | null,
  providerType: string | null,
  providerMessageId: string,
  eventType: typeof emailEvents.$inferInsert['eventType'],
  rawPayload: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Promise<void> {
  const cleanMeta = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined),
  )
  await db.insert(emailEvents).values({
    emailSendId,
    providerMessageId: providerMessageId || null,
    providerId,
    providerType,
    eventType,
    rawPayload,
    metadata: Object.keys(cleanMeta).length ? cleanMeta : null,
    occurredAt: new Date(),
  })
  console.log(`[WebhookWorker] Inserted ${eventType} event for send ${emailSendId}`)
}

export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(WEBHOOK_QUEUE_NAME, processWebhookJob, {
    connection: bullMQConnection(),
    concurrency: 20,
  })

  worker.on('failed', (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[WebhookWorker] Worker error:', err.message)
  })

  return worker
}
