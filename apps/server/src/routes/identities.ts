import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { emailIdentities } from "../db/schema.js";
import { desc, count } from "drizzle-orm";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const identitiesRoutes = new Hono();

identitiesRoutes.get("/identities", zValidator("query", listSchema), async (c) => {
  const { page, limit } = c.req.valid("query");
  const offset = (page - 1) * limit;

  const [items, countRows] = await Promise.all([
    db.select().from(emailIdentities).orderBy(desc(emailIdentities.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(emailIdentities),
  ]);

  return c.json({ items, total: countRows[0]?.total ?? 0, page, limit });
});
