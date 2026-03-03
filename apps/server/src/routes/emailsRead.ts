import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, desc, asc, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { emailSends, emailEvents } from "../db/schema.js";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const emailsReadRoutes = new Hono();

emailsReadRoutes.get("/emails", zValidator("query", listSchema), async (c) => {
  const { page, limit } = c.req.valid("query");
  const offset = (page - 1) * limit;

  const [items, countRows] = await Promise.all([
    db.select().from(emailSends).orderBy(desc(emailSends.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(emailSends),
  ]);

  return c.json({ items, total: countRows[0]?.total ?? 0, page, limit });
});

emailsReadRoutes.get("/emails/:id", async (c) => {
  const id = c.req.param("id");

  const [rows, events] = await Promise.all([
    db.select().from(emailSends).where(eq(emailSends.id, id)).limit(1),
    db.select().from(emailEvents).where(eq(emailEvents.emailSendId, id)).orderBy(asc(emailEvents.occurredAt)),
  ]);

  if (rows.length === 0) {
    return c.json({ error: "Not found" }, 404);
  }

  const send = rows[0];

  const timeline = [
    { event: "queued", occurredAt: send.createdAt, metadata: null },
    ...events.map((e) => ({
      event: e.eventType,
      occurredAt: e.occurredAt,
      metadata: e.metadata ?? null,
    })),
  ];

  return c.json({ ...send, timeline });
});
