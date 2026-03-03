import { count } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { user } from '../db/schema.ts'

export default defineEventHandler(async (event) => {
  const [result] = await db.select({ count: count() }).from(user)
  return { setupRequired: result.count === 0 }
})
