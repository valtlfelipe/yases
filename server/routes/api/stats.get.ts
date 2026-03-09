import { db } from '../../db/index'
import { emailSends, emailEvents, suppressionList } from '../../db/schema'
import { sql, count } from 'drizzle-orm'
import { requireApiAuth } from '../../utils/requireApiAuth'

export default defineEventHandler(async (event) => {
  await requireApiAuth(event)

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
      WITH last_7_days AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW()) - INTERVAL '6 days',
          DATE_TRUNC('day', NOW()),
          '1 day'::interval
        ) AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(COUNT(e.*), 0) AS total,
        COALESCE(COUNT(*) FILTER (WHERE e.status IN ('sent', 'delivered', 'opened', 'complained', 'bounced')), 0) AS sent,
        COALESCE(COUNT(*) FILTER (WHERE e.status IN ('delivered', 'opened', 'complained')), 0) AS delivered,
        COALESCE(COUNT(*) FILTER (WHERE e.status = 'bounced'), 0) AS bounced,
        COALESCE(COUNT(*) FILTER (WHERE e.status = 'opened'), 0) AS opened,
        COALESCE(COUNT(*) FILTER (WHERE e.status = 'failed'), 0) AS failed
      FROM last_7_days d
      LEFT JOIN email_sends e ON DATE_TRUNC('day', e.created_at) = d.day
      GROUP BY d.day
      ORDER BY d.day
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
    delivered: sendsByStatus['delivered'] ?? 0,
    opened: sendsByStatus['opened'] ?? 0,
    complained: sendsByStatus['complained'] ?? 0,
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

  // emails that left the queue and reached SES (excludes queued / sending / suppressed)
  const totalAttempted = sends.sent + sends.delivered + sends.opened + sends.complained + sends.failed + sends.bounced
  // emails confirmed delivered by SES (regardless of whether they later opened or complained)
  const deliveredCount = sends.delivered + sends.opened + sends.complained

  const rates = {
    delivery: totalAttempted > 0 ? Math.round((deliveredCount / totalAttempted) * 1000) / 10 : 0,
    bounce: totalAttempted > 0 ? Math.round((sends.bounced / totalAttempted) * 1000) / 10 : 0,
    complaint: totalAttempted > 0 ? Math.round((sends.complained / totalAttempted) * 1000) / 10 : 0,
    open: deliveredCount > 0 ? Math.round((sends.opened / deliveredCount) * 1000) / 10 : 0,
    click: deliveredCount > 0 ? Math.round((events.clicked / deliveredCount) * 1000) / 10 : 0,
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

  return { sends, events, rates, suppressions, trend, deliveredCount }
})
