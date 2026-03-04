import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  SES_CONFIGURATION_SET: z.string().optional(),

  DISPOSABLE_BLOCKLIST_URL: z
    .string()
    .url()
    .default(
      'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt',
    ),
  EMAIL_QUEUE_CONCURRENCY: z.coerce.number().default(10),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),

  TOKEN_SECRET: z.string().min(32),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
