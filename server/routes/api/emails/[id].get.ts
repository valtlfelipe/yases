import { eq, asc } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends, emailEvents } from '../../../db/schema'
import { requireApiAuth } from '../../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

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

  const send = rows[0]!

  const timeline = events.map(e => ({
    event: e.eventType,
    occurredAt: e.occurredAt,
    metadata: e.metadata ?? null,
  }))

  return { ...send, timeline }
})
