import { auth } from '../../lib/auth'
import { db } from '../../db/index'
import { emailSends, emailEvents, suppressionList } from '../../db/schema'
import { sql, count } from 'drizzle-orm'

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
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const [sendsRows, eventsRows, suppressionsRow, trendRows] = await Promise.all([
    db
      .select({ status: emailSends.status, count: count() })
      .from(emailSends)
      .groupBy(emailSends.status),

    db
      .select({ eventType: emailEvents.eventType, count: count() })
      .from(emailEvents)
      .groupBy(emailEvents.eventType),

    db.select({ total: count() }).from(suppressionList),

    db.execute(sql`
      SELECT
        to_char(date_trunc('day', es.created_at), 'YYYY-MM-DD') AS date,
        COUNT(DISTINCT es.id) AS total,
        COUNT(DISTINCT es.id) AS sent,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'delivery' THEN es.id END) AS delivered,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'bounce' THEN es.id END) AS bounced,
        COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN es.id END) AS opened,
        COUNT(DISTINCT es.id) FILTER (WHERE es.status = 'failed') AS failed
      FROM email_sends es
      LEFT JOIN email_events ee ON ee.email_send_id = es.id
      WHERE es.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY date_trunc('day', es.created_at)
      ORDER BY date_trunc('day', es.created_at)
    `),
  ])

  const sendsByStatus: Record<string, number> = {}
  for (const row of sendsRows) {
    sendsByStatus[row.status] = row.count
  }

  const sends = {
    total: Object.values(sendsByStatus).reduce((a, b) => a + b, 0),
    queued: sendsByStatus['queued'] ?? 0,
    sending: sendsByStatus['sending'] ?? 0,
    sent: sendsByStatus['sent'] ?? 0,
    failed: sendsByStatus['failed'] ?? 0,
    suppressed: sendsByStatus['suppressed'] ?? 0,
    bounced: sendsByStatus['bounced'] ?? 0,
  }

  const eventsByType: Record<string, number> = {}
  for (const row of eventsRows) {
    eventsByType[row.eventType] = row.count
  }

  const events = {
    delivered: eventsByType['delivery'] ?? 0,
    bounced: eventsByType['bounce'] ?? 0,
    complained: eventsByType['complaint'] ?? 0,
    opened: eventsByType['open'] ?? 0,
    clicked: eventsByType['click'] ?? 0,
  }

  const totalAttempted = sends.sent + sends.failed + sends.bounced
  const rates = {
    delivery: totalAttempted > 0 ? Math.round((events.delivered / totalAttempted) * 1000) / 10 : 0,
    bounce: totalAttempted > 0 ? Math.round((events.bounced / totalAttempted) * 1000) / 10 : 0,
    complaint: totalAttempted > 0 ? Math.round((events.complained / totalAttempted) * 1000) / 10 : 0,
    open: events.delivered > 0 ? Math.round((events.opened / events.delivered) * 1000) / 10 : 0,
    click: events.delivered > 0 ? Math.round((events.clicked / events.delivered) * 1000) / 10 : 0,
  }

  const suppressions = suppressionsRow[0]?.total ?? 0

  const trend = (
    trendRows.rows as Array<{ date: string, total: string, sent: string, delivered: string, bounced: string, opened: string, failed: string }>
  ).map(r => ({
    date: r.date,
    total: parseInt(r.total, 10),
    sent: parseInt(r.sent, 10),
    delivered: parseInt(r.delivered, 10),
    bounced: parseInt(r.bounced, 10),
    opened: parseInt(r.opened, 10),
    failed: parseInt(r.failed, 10),
  }))

  return { sends, events, rates, suppressions, trend }
})
