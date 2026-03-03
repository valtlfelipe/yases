import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core'

// Better Auth tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const identityStatusEnum = pgEnum('identity_status', [
  'pending',
  'verified',
  'failed',
  'temporarily_failed',
])

export const suppressionReasonEnum = pgEnum('suppression_reason', [
  'permanent_bounce',
  'transient_bounce',
  'complaint',
  'invalid',
  'manual',
])

export const emailStatusEnum = pgEnum('email_status', [
  'queued',
  'sending',
  'sent',
  'failed',
  'suppressed',
])

export const emailEventTypeEnum = pgEnum('email_event_type', [
  'submitted', // we handed the email to SES (worker)
  'send', // SES confirmed it started transmitting (SNS)
  'delivery',
  'bounce',
  'complaint',
  'reject',
  'open',
  'click',
])

export const suppressionList = pgTable('suppression_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  reason: suppressionReasonEnum('reason').notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const emailSends = pgTable('email_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  from: text('from').notNull(),
  subject: text('subject').notNull(),
  htmlBody: text('html_body'),
  textBody: text('text_body'),
  replyTo: text('reply_to'),
  status: emailStatusEnum('status').notNull().default('queued'),
  jobId: text('job_id'),
  sesMessageId: text('ses_message_id'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
})

export const emailIdentities = pgTable('email_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: text('domain').unique().notNull(),
  status: identityStatusEnum('status').notNull().default('pending'),
  dkimTokens: text('dkim_tokens').array(),
  dkimStatus: text('dkim_status'),
  mailFromDomain: text('mail_from_domain'),
  rawAttributes: jsonb('raw_attributes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const apikey = pgTable('apikey', {
  id: text('id').primaryKey(),
  configId: text('config_id').notNull().default('default'),
  name: text('name'),
  start: text('start'),
  referenceId: text('reference_id').notNull(),
  prefix: text('prefix'),
  key: text('key').notNull(),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: timestamp('last_refill_at'),
  enabled: boolean('enabled').default(true),
  rateLimitEnabled: boolean('rate_limit_enabled').default(true),
  rateLimitTimeWindow: integer('rate_limit_time_window'),
  rateLimitMax: integer('rate_limit_max'),
  requestCount: integer('request_count').default(0),
  remaining: integer('remaining'),
  lastRequest: timestamp('last_request'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
})

export const emailEvents = pgTable('email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailSendId: uuid('email_send_id')
    .notNull()
    .references(() => emailSends.id, { onDelete: 'cascade' }),
  sesMessageId: text('ses_message_id').notNull(),
  eventType: emailEventTypeEnum('event_type').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
})
