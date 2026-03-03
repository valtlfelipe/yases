import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { apiRoutes } from "./routes/api.js";
import { dashboardRoutes } from "./routes/dashboard.js";

const app = new Hono();

app.route("/", healthRoutes);
app.route("/", webhookRoutes);

// Better Auth — CORS + handler (must be before /api routes)
app.use(
  "/api/auth/*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api", apiRoutes);
app.route("/dashboard", dashboardRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[Server] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

console.log(`[Server] Starting on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
