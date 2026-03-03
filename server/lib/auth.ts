import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { apiKey } from '@better-auth/api-key'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { db } from '../db/index'
import { env } from '../lib/env'
import { redis } from '../cache/redis'
import { count } from 'drizzle-orm'
import { user } from '../db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        const [result] = await db.select({ count: count() }).from(user)
        if (result && result.count > 0) {
          throw new APIError('BAD_REQUEST', {
            message: 'An account already exists. Sign in instead.',
          })
        }
      }
    }),
  },
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
