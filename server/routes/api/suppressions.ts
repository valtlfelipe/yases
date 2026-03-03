import { auth } from '../../lib/auth.ts'
import { SuppressionService } from '../../services/SuppressionService.ts'

const suppressionReasons = [
  'permanent_bounce',
  'transient_bounce',
  'complaint',
  'invalid',
  'manual',
] as const

const suppressionService = new SuppressionService()

export default defineEventHandler(async (event) => {
  const headers = event.headers

  let session = await auth.api.getSession({ headers }).catch(() => null)

  if (!session) {
    const apiKey = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (apiKey) {
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })
      if (!result.valid) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
      }
      session = { user: result.key as any, session: null }
    }
  }

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const method = event.method
  const emailParam = getRouterParam(event, 'email')

  if (method === 'GET' && !emailParam) {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const limit = Math.min(Number(query.limit) || 20, 100)
    const reason = query.reason as (typeof suppressionReasons)[number] | undefined

    const result = await suppressionService.list(page, limit, reason)
    return { items: result.items, total: result.total, page, limit }
  }

  if (method === 'GET' && emailParam) {
    const email = decodeURIComponent(emailParam)
    const entry = await suppressionService.isSuppressed(email)

    if (!entry) {
      return { suppressed: false }
    }
    return { suppressed: true, reason: entry.reason, detail: entry.detail }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const email = body.email as string
    const reason = (body.reason as (typeof suppressionReasons)[number]) || 'manual'
    const detail = body.detail as string | undefined

    await suppressionService.add(email, reason, detail)
    setResponseStatus(event, 201)
    return { success: true, email: email.toLowerCase(), reason }
  }

  if (method === 'DELETE' && emailParam) {
    const email = decodeURIComponent(emailParam)
    const removed = await suppressionService.remove(email)

    if (!removed) {
      setResponseStatus(event, 404)
      return { error: 'Not found' }
    }
    return { success: true }
  }

  setResponseStatus(event, 405)
  return { error: 'Method not allowed' }
})
