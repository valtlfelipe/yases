import type { ProviderEvent, ProviderType } from '../lib/providers'

export interface WebhookJobData {
  provider: ProviderType
  event: ProviderEvent
  rawPayload: Record<string, unknown>
}

export interface EmailJobData {
  emailSendId: string
  to: string
  from: string
  subject: string
  html?: string
  text?: string
  replyTo?: string
  tenantName?: string
  unsubscribeUrl?: string
  enqueuedAt: string
  providerId?: string
}
