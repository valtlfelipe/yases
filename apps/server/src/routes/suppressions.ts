import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { SuppressionService } from "../services/SuppressionService.js";

const suppressionReasons = [
  "permanent_bounce",
  "transient_bounce",
  "complaint",
  "invalid",
  "manual",
] as const;

const addSchema = z.object({
  email: z.string().email(),
  reason: z.enum(suppressionReasons).default("manual"),
  detail: z.string().optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  reason: z.enum(suppressionReasons).optional(),
});

const suppressionService = new SuppressionService();

export const suppressionRoutes = new Hono();

suppressionRoutes.get("/suppressions", zValidator("query", listSchema), async (c) => {
  const { page, limit, reason } = c.req.valid("query");
  const result = await suppressionService.list(page, limit, reason);
  return c.json({ items: result.items, total: result.total, page, limit });
});

suppressionRoutes.get("/suppressions/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email"));
  const entry = await suppressionService.isSuppressed(email);

  if (!entry) {
    return c.json({ suppressed: false });
  }
  return c.json({ suppressed: true, reason: entry.reason, detail: entry.detail });
});

suppressionRoutes.post("/suppressions", zValidator("json", addSchema), async (c) => {
  const { email, reason, detail } = c.req.valid("json");
  await suppressionService.add(email, reason, detail);
  return c.json({ success: true, email: email.toLowerCase(), reason }, 201);
});

suppressionRoutes.delete("/suppressions/:email", async (c) => {
  const email = decodeURIComponent(c.req.param("email"));
  const removed = await suppressionService.remove(email);

  if (!removed) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ success: true });
});
