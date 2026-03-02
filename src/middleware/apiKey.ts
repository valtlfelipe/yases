import type { MiddlewareHandler } from "hono";
import { env } from "../config/env.js";

export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKeyHeader = c.req.header("x-api-key");
  const authHeader = c.req.header("authorization");

  let providedKey: string | undefined;

  if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  } else if (authHeader?.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  }

  if (!providedKey || providedKey !== env.API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
