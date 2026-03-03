export interface WebhookJobData {
  notificationType: string
  notification: Record<string, unknown>
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
  enqueuedAt: string
}
