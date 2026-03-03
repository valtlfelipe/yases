import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { db } from "../db/index.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: (request) => {
    const origin = request?.headers?.get("origin");
    return origin ? [origin] : [];
  },
  plugins: [
    apiKey([
      {
        configId: "default",
        defaultPrefix: "sk_",
        enableMetadata: true,
        rateLimit: {
          enabled: true,
          maxRequests: 1000,
          timeWindow: 1000 * 60 * 60, // 1 hour
        },
      },
    ]),
  ],
});
