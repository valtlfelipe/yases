import { Hono } from "hono";
import { checkDbConnection } from "../db/index.js";
import { checkRedisConnection } from "../cache/redis.js";

export const healthRoutes = new Hono();

healthRoutes.get("/health", async (c) => {
  const [dbOk, redisOk] = await Promise.all([checkDbConnection(), checkRedisConnection()]);

  const status = dbOk && redisOk ? "ok" : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;

  return c.json(
    {
      status,
      db: dbOk ? "ok" : "error",
      redis: redisOk ? "ok" : "error",
    },
    httpStatus
  );
});
