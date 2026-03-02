import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const identityStatusEnum = pgEnum("identity_status", [
  "pending",
  "verified",
  "failed",
  "temporarily_failed",
]);

export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "permanent_bounce",
  "transient_bounce",
  "complaint",
  "invalid",
  "manual",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sending",
  "sent",
  "failed",
  "suppressed",
]);

export const emailEventTypeEnum = pgEnum("email_event_type", [
  "submitted",  // we handed the email to SES (worker)
  "send",       // SES confirmed it started transmitting (SNS)
  "delivery",
  "bounce",
  "complaint",
  "reject",
  "open",
  "click",
]);

export const suppressionList = pgTable("suppression_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  reason: suppressionReasonEnum("reason").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailSends = pgTable("email_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  from: text("from").notNull(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body"),
  textBody: text("text_body"),
  replyTo: text("reply_to"),
  status: emailStatusEnum("status").notNull().default("queued"),
  jobId: text("job_id"),
  sesMessageId: text("ses_message_id"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

export const emailIdentities = pgTable("email_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").unique().notNull(),
  status: identityStatusEnum("status").notNull().default("pending"),
  dkimTokens: text("dkim_tokens").array(),
  dkimStatus: text("dkim_status"),
  mailFromDomain: text("mail_from_domain"),
  rawAttributes: jsonb("raw_attributes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailEvents = pgTable("email_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailSendId: uuid("email_send_id")
    .notNull()
    .references(() => emailSends.id, { onDelete: "cascade" }),
  sesMessageId: text("ses_message_id").notNull(),
  eventType: emailEventTypeEnum("event_type").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});
