import { auth } from '../../../lib/auth'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailEvents, emailSends } from '../../../db/schema'

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
      // @ts-expect-error - API key authentication creates a minimal session object
      session = { user: result.key, session: null }
    }
  }

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 100)

  const rows = await db
    .select({
      id: emailEvents.id,
      eventType: emailEvents.eventType,
      occurredAt: emailEvents.occurredAt,
      emailSendId: emailEvents.emailSendId,
      metadata: emailEvents.metadata,
      to: emailSends.to,
      subject: emailSends.subject,
    })
    .from(emailEvents)
    .innerJoin(emailSends, eq(emailEvents.emailSendId, emailSends.id))
    .orderBy(desc(emailEvents.occurredAt))
    .limit(limit)

  return rows
})
