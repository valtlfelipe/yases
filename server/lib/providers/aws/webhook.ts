import type { WebhookPayload, ProviderEvent, ProviderType } from '../types'

export function parseAwsWebhook(body: unknown): WebhookPayload {
  const payload = body as Record<string, unknown>

  const messageType = payload['Type'] as string | undefined

  // Handle SNS SubscriptionConfirmation
  if (messageType === 'SubscriptionConfirmation') {
    return {
      provider: 'aws' as ProviderType,
      rawBody: body,
      events: [],
    }
  }

  if (messageType !== 'Notification') {
    return {
      provider: 'aws' as ProviderType,
      rawBody: body,
      events: [],
    }
  }

  let notification: Record<string, unknown>
  try {
    notification = JSON.parse(payload['Message'] as string)
  }
  catch {
    return {
      provider: 'aws' as ProviderType,
      rawBody: body,
      events: [],
    }
  }

  const notificationType = (notification['notificationType'] ?? notification['eventType']) as string | undefined

  if (!notificationType) {
    return {
      provider: 'aws' as ProviderType,
      rawBody: body,
      events: [],
    }
  }

  const mail = notification['mail'] as Record<string, unknown> | undefined
  const sesMessageId = mail?.['messageId'] as string | undefined

  const event: ProviderEvent = {
    eventType: normalizeEventType(notificationType),
    messageId: sesMessageId,
    timestamp: new Date(),
    metadata: notification,
  }

  // For bounce events, extract recipient
  if (notification['bounce']) {
    const bounce = notification['bounce'] as Record<string, unknown>
    const bouncedRecipients = bounce?.['bouncedRecipients'] as Array<Record<string, unknown>> | undefined
    if (bouncedRecipients && bouncedRecipients.length > 0) {
      event.recipient = bouncedRecipients[0]?.['emailAddress'] as string | undefined
    }
  }

  // For complaint events, extract recipient
  if (notification['complaint']) {
    const complaint = notification['complaint'] as Record<string, unknown>
    const complainedRecipients = complaint?.['complainedRecipients'] as Array<Record<string, unknown>> | undefined
    if (complainedRecipients && complainedRecipients.length > 0) {
      event.recipient = complainedRecipients[0]?.['emailAddress'] as string | undefined
    }
  }

  return {
    provider: 'aws' as ProviderType,
    rawBody: body,
    events: [event],
  }
}

function normalizeEventType(notificationType: string): string {
  const mapping: Record<string, string> = {
    Bounce: 'bounce',
    Complaint: 'complaint',
    Delivery: 'delivery',
    Send: 'send',
    Reject: 'reject',
    Open: 'open',
    Click: 'click',
  }
  return mapping[notificationType] || notificationType.toLowerCase()
}
