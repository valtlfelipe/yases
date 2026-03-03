import { webhookQueue } from '../../../queue/webhookQueue'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }

  let body: Record<string, unknown>
  try {
    body = await readBody(event)
  }
  catch {
    return { ok: true }
  }

  const messageType = body['Type'] as string | undefined

  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body['SubscribeURL'] as string | undefined
    if (subscribeUrl) {
      try {
        const res = await fetch(subscribeUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        console.log('[Webhook] SNS subscription confirmed')
      }
      catch (err) {
        console.error('[Webhook] Failed to confirm SNS subscription:', (err as Error).message)
      }
    }
    return { ok: true }
  }

  if (messageType !== 'Notification') {
    return { ok: true }
  }

  let notification: Record<string, unknown>
  try {
    notification = JSON.parse(body['Message'] as string)
  }
  catch {
    return { ok: true }
  }

  const notificationType = (notification['notificationType'] ?? notification['eventType']) as string | undefined
  if (notificationType) {
    const sesMessageId = (notification['mail'] as Record<string, unknown> | undefined)?.['messageId']
    console.log(`[Webhook] Enqueuing ${notificationType} | sesMessageId: ${sesMessageId ?? '(none)'}`)
    await webhookQueue.add(notificationType, {
      notificationType,
      notification,
      rawPayload: body,
    })
  }
  else {
    console.warn('[Webhook] Notification missing notificationType, raw message:', body['Message'])
  }

  return { ok: true }
})
