import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "../lib/auth.js";
import { emailsReadRoutes } from "./emailsRead.js";
import { suppressionRoutes } from "./suppressions.js";
import { statsRoutes } from "./stats.js";
import { identitiesRoutes } from "./identities.js";

export const dashboardRoutes = new Hono();

dashboardRoutes.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

dashboardRoutes.use("*", async (c, next) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

dashboardRoutes.route("/", emailsReadRoutes);
dashboardRoutes.route("/", suppressionRoutes);
dashboardRoutes.route("/", statsRoutes);
dashboardRoutes.route("/", identitiesRoutes);
