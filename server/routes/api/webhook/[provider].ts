import { webhookQueue } from '../../../queue/webhookQueue'
import { getProvider, type ProviderType } from '../../../lib/providers'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }

  const providerParam = getRouterParam(event, 'provider')
  const providerType = (providerParam === 'ses' ? 'aws' : providerParam) as ProviderType

  if (!providerType) {
    throw createError({
      statusCode: 400,
      message: 'Provider type is required',
    })
  }

  // Validate provider type
  const validProviders: ProviderType[] = ['aws', 'sendgrid', 'mailgun']
  if (!validProviders.includes(providerType)) {
    throw createError({
      statusCode: 400,
      message: `Unknown provider: ${providerType}`,
    })
  }

  let body: Record<string, unknown>
  try {
    body = await readBody(event)
    body = typeof body === 'string' ? JSON.parse(body) : body
  }
  catch {
    return { ok: true }
  }

  // Handle AWS SNS SubscriptionConfirmation
  if (providerType === 'aws') {
    const messageType = body['Type'] as string | undefined

    if (messageType === 'SubscriptionConfirmation') {
      const subscribeUrl = body['SubscribeURL'] as string | undefined
      if (!subscribeUrl) return { ok: true }

      let parsed: URL
      try {
        parsed = new URL(subscribeUrl)
      }
      catch {
        console.warn('[Webhook] SNS SubscriptionConfirmation has invalid SubscribeURL')
        return { ok: true }
      }

      const SNS_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com$/
      if (parsed.protocol !== 'https:' || !SNS_HOST_RE.test(parsed.hostname)) {
        console.warn(`[Webhook] SNS SubscriptionConfirmation rejected — disallowed host: ${parsed.hostname}`)
        return { ok: true }
      }

      try {
        const res = await fetch(subscribeUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        console.log('[Webhook] SNS subscription confirmed')
      }
      catch (err) {
        console.error('[Webhook] Failed to confirm SNS subscription:', (err as Error).message)
      }
      return { ok: true }
    }

    if (messageType !== 'Notification') {
      return { ok: true }
    }
  }

  try {
    const provider = getProvider(providerType)
    const payload = provider.parseWebhook(body)

    for (const eventData of payload.events) {
      console.log(`[Webhook] Enqueuing ${eventData.eventType} | provider: ${providerType} | messageId: ${eventData.messageId ?? '(none)'}`)

      await webhookQueue.add(eventData.eventType, {
        provider: providerType,
        event: eventData,
        rawPayload: payload.rawBody as Record<string, unknown>,
      })
    }
  }
  catch (err) {
    console.error(`[Webhook] Error processing ${providerType} webhook:`, err)
  }

  return { ok: true }
})
