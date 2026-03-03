import { Hono } from "hono";
import { apiKeyMiddleware } from "../middleware/apiKey.js";
import { emailRoutes } from "./emails.js";

export const apiRoutes = new Hono();

apiRoutes.use("*", apiKeyMiddleware);

apiRoutes.route("/", emailRoutes);
