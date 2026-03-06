import { desc, eq } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailEvents, emailSends } from '../../../db/schema'
import { requireApiAuth } from '../../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

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
