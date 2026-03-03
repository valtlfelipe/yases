import { env } from '../lib/env.ts'

export function bullMQConnection() {
  const url = new URL(env.REDIS_URL)
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 6379,
    ...(url.password && { password: decodeURIComponent(url.password) }),
    ...(url.username && url.username !== 'default' && { username: url.username }),
    maxRetriesPerRequest: null as null,
  }
}
