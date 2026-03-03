import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../lib/env.ts'
import * as schema from '../db/schema.ts'

const pool = new Pool({ connectionString: env.DATABASE_URL })

export const db = drizzle(pool, { schema })

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  }
  catch {
    return false
  }
}
