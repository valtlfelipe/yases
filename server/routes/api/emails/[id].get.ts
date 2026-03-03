import { auth } from '../../../lib/auth.ts'
import { eq, asc } from 'drizzle-orm'
import { db } from '../../../db/index.ts'
import { emailSends, emailEvents } from '../../../db/schema.ts'

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

  const id = getRouterParam(event, 'id')

  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'ID is required' }
  }

  const [rows, events] = await Promise.all([
    db.select().from(emailSends).where(eq(emailSends.id, id)).limit(1),
    db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.emailSendId, id))
      .orderBy(asc(emailEvents.occurredAt)),
  ])

  if (rows.length === 0) {
    setResponseStatus(event, 404)
    return { error: 'Not found' }
  }

  const send = rows[0]

  const timeline = [
    { event: 'queued', occurredAt: send.createdAt, metadata: null },
    ...events.map(e => ({
      event: e.eventType,
      occurredAt: e.occurredAt,
      metadata: e.metadata ?? null,
    })),
  ]

  return { ...send, timeline }
})
