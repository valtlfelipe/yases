import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { apiKey } from '@better-auth/api-key'
import { db } from '../db/index.ts'
import { env } from '../lib/env.ts'
import { redis } from '../cache/redis.ts'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // trustedOrigins: (request) => {
  //   const origin = request?.headers?.get("origin");
  //   return origin ? [origin] : [];
  // },
  secondaryStorage: {
    get: async key => redis.get(`ba:${key}`),
    set: async (key, value, ttl) => {
      if (ttl) await redis.setex(`ba:${key}`, ttl, value)
      else await redis.set(`ba:${key}`, value)
    },
    delete: async (key) => {
      await redis.del(`ba:${key}`)
    },
  },
  plugins: [
    apiKey([
      {
        configId: 'default',
        defaultPrefix: 'sk_',
        enableMetadata: true,
        storage: 'secondary-storage',
        fallbackToDatabase: true,
        rateLimit: {
          enabled: true,
          maxRequests: 1000,
          timeWindow: 1000 * 60 * 60,
        },
        apiKeyHeaders: ['authorization', 'x-api-key'],
      },
    ]),
  ],
})
