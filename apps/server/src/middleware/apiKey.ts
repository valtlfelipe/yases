import type { MiddlewareHandler } from "hono";
import { auth } from "../lib/auth.js";

export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const key = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!key) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await auth.api.verifyApiKey({ body: { key } });
  if (!result?.valid) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
