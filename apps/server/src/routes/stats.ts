import { Hono } from "hono";
import { db } from "../db/index.js";
import { emailSends, emailEvents, suppressionList } from "../db/schema.js";
import { sql, count } from "drizzle-orm";

export const statsRoutes = new Hono();

statsRoutes.get("/stats", async (c) => {
  const [sendsRows, eventsRows, suppressionsRow, trendRows] = await Promise.all([
    db.select({ status: emailSends.status, count: count() })
      .from(emailSends)
      .groupBy(emailSends.status),

    db.select({ eventType: emailEvents.eventType, count: count() })
      .from(emailEvents)
      .groupBy(emailEvents.eventType),

    db.select({ total: count() }).from(suppressionList),

    db.execute(sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
      FROM email_sends
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at)
    `),
  ]);

  // Sends by status
  const sendsByStatus: Record<string, number> = {};
  for (const row of sendsRows) {
    sendsByStatus[row.status] = row.count;
  }

  const sends = {
    total: Object.values(sendsByStatus).reduce((a, b) => a + b, 0),
    queued: sendsByStatus["queued"] ?? 0,
    sending: sendsByStatus["sending"] ?? 0,
    sent: sendsByStatus["sent"] ?? 0,
    failed: sendsByStatus["failed"] ?? 0,
    suppressed: sendsByStatus["suppressed"] ?? 0,
  };

  // Events by type
  const eventsByType: Record<string, number> = {};
  for (const row of eventsRows) {
    eventsByType[row.eventType] = row.count;
  }

  const events = {
    delivered: eventsByType["delivery"] ?? 0,
    bounced: eventsByType["bounce"] ?? 0,
    complained: eventsByType["complaint"] ?? 0,
    opened: eventsByType["open"] ?? 0,
    clicked: eventsByType["click"] ?? 0,
  };

  // Delivery rates (percentages)
  const totalAttempted = sends.sent + sends.failed;
  const rates = {
    delivery: totalAttempted > 0 ? Math.round((events.delivered / totalAttempted) * 1000) / 10 : 0,
    bounce: totalAttempted > 0 ? Math.round((events.bounced / totalAttempted) * 1000) / 10 : 0,
    open: events.delivered > 0 ? Math.round((events.opened / events.delivered) * 1000) / 10 : 0,
    click: events.delivered > 0 ? Math.round((events.clicked / events.delivered) * 1000) / 10 : 0,
  };

  const suppressions = suppressionsRow[0]?.total ?? 0;

  const trend = (trendRows.rows as Array<{ date: string; total: string; sent: string; failed: string }>).map((r) => ({
    date: r.date,
    total: parseInt(r.total, 10),
    sent: parseInt(r.sent, 10),
    failed: parseInt(r.failed, 10),
  }));

  return c.json({ sends, events, rates, suppressions, trend });
});
