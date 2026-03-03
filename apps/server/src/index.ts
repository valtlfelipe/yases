import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
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

// Serve Nuxt SPA static assets (JS, CSS, images, etc.)
app.use("*", serveStatic({ root: "./public" }));

// Catch-all: SPA routing fallback for the web UI, JSON 404 for API/webhook paths
app.notFound(async (c) => {
  if (
    c.req.path.startsWith("/api/") ||
    c.req.path.startsWith("/webhook/") ||
    c.req.path === "/health"
  ) {
    return c.json({ error: "Not found" }, 404);
  }
  try {
    const html = await Bun.file("./public/index.html").text();
    return c.html(html);
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

app.onError((err, c) => {
  console.error("[Server] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

console.log(`[Server] Starting on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
