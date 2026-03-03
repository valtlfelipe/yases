import { count } from 'drizzle-orm'
import { db } from '../db/index'
import { user } from '../db/schema'

export default defineEventHandler(async (_event) => {
  const [result] = await db.select({ count: count() }).from(user)
  return { setupRequired: result.count === 0 }
})
