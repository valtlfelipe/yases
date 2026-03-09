import { webhookQueue } from '../../../queue/webhookQueue'
import { getProvider, getProviderTypes, resolveProviderType } from '../../../lib/providers'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }

  const providerParam = getRouterParam(event, 'provider')
  const providerType = resolveProviderType(providerParam)
  const query = getQuery(event)
  const providerIdRaw = typeof query.providerId === 'string' ? query.providerId : undefined
  const providerId = providerIdRaw && /^[0-9a-f-]{36}$/i.test(providerIdRaw) ? providerIdRaw : undefined

  if (!providerType) {
    throw createError({
      statusCode: 400,
      message: 'Provider type is required',
    })
  }

  // Validate provider type
  const validProviders = getProviderTypes()
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

  try {
    const provider = getProvider(providerType)
    if (provider.handleWebhookRequest) {
      const result = await provider.handleWebhookRequest(body)
      if (result.handled) {
        return { ok: true }
      }
    }

    const payload = provider.parseWebhook(body)

    for (const eventData of payload.events) {
      console.log(`[Webhook] Enqueuing ${eventData.eventType} | provider: ${providerType} | messageId: ${eventData.messageId ?? '(none)'}`)

      await webhookQueue.add(eventData.eventType, {
        provider: providerType,
        providerId,
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
