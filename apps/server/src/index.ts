import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { count } from "drizzle-orm";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { db } from "./db/index.js";
import { user } from "./db/schema.js";
import { healthRoutes } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { apiRoutes } from "./routes/api.js";
import { dashboardRoutes } from "./routes/dashboard.js";

const app = new Hono();

// /api/auth/* — credentials CORS (session cookies must work cross-origin in dev)
// /api/*      — open CORS (public API, authenticated via API key header)
// A single branching middleware avoids double-running on /api/auth/* preflight.
app.use("/api/*", (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) {
    return cors({
      origin: (origin) => origin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    })(c, next);
  }
  return cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })(c, next);
});

// /dashboard/* — credentials CORS (session-based, browser-only)
app.use(
  "/dashboard/*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.route("/", healthRoutes);
app.route("/", webhookRoutes);

// Setup status — open CORS, public, outside /api to keep routing boundaries clear
app.use("/setup-status", cors({ origin: "*" }));
app.get("/setup-status", async (c) => {
  const [result] = await db.select({ count: count() }).from(user);
  return c.json({ setupRequired: result.count === 0 });
});

// Block signup when an account already exists
app.use("/api/auth/sign-up/*", async (c, next) => {
  const [result] = await db.select({ count: count() }).from(user);
  if (result.count > 0) {
    return c.json({ error: "Registration is disabled. This instance already has an account." }, 403);
  }
  await next();
});

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
