import { checkDbConnection } from '../db/index'
import { checkRedisConnection } from '../cache/redis'

export default defineEventHandler(async (event) => {
  const [dbOk, redisOk] = await Promise.all([
    checkDbConnection(),
    checkRedisConnection(),
  ])

  const status = dbOk && redisOk ? 'ok' : 'degraded'
  const httpStatus = status === 'ok' ? 200 : 503

  setResponseStatus(event, httpStatus)

  return {
    status,
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
  }
})
