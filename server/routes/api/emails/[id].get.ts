import { eq, asc } from 'drizzle-orm'
import { db } from '../../../db/index'
import { emailSends, emailEvents, emailIdentities, providers } from '../../../db/schema'
import { requireApiAuth } from '../../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'ID is required' }
  }

  const [rows, events] = await Promise.all([
    db
      .select({
        send: emailSends,
        providerName: providers.name,
        providerDisplayName: providers.displayName,
      })
      .from(emailSends)
      .leftJoin(emailIdentities, eq(emailSends.fromDomain, emailIdentities.domain))
      .leftJoin(providers, eq(emailIdentities.providerId, providers.id))
      .where(eq(emailSends.id, id))
      .limit(1),
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

  const row = rows[0]!
  const send = row.send

  const timeline = events.map(e => ({
    event: e.eventType,
    occurredAt: e.occurredAt,
    metadata: e.metadata ?? null,
  }))

  return {
    ...send,
    providerName: row.providerDisplayName ?? row.providerName ?? null,
    timeline,
  }
})
