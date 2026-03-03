import Redis from 'ioredis'
import { env } from '../lib/env.ts'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message)
})

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  }
  catch {
    return false
  }
}
