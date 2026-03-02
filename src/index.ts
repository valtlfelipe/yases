import { Hono } from "hono";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { emailRoutes } from "./routes/emails.js";
import { suppressionRoutes } from "./routes/suppressions.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { apiKeyMiddleware } from "./middleware/apiKey.js";

const app = new Hono();

app.use("/emails/*", apiKeyMiddleware);
app.use("/emails", apiKeyMiddleware);
app.use("/suppressions/*", apiKeyMiddleware);
app.use("/suppressions", apiKeyMiddleware);

app.route("/", healthRoutes);
app.route("/", emailRoutes);
app.route("/", suppressionRoutes);
app.route("/", webhookRoutes);

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
