DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_events'
      AND column_name = 'ses_message_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_events'
      AND column_name = 'provider_message_id'
  ) THEN
    ALTER TABLE "email_events" RENAME COLUMN "ses_message_id" TO "provider_message_id";
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_sends'
      AND column_name = 'ses_message_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_sends'
      AND column_name = 'provider_message_id'
  ) THEN
    ALTER TABLE "email_sends" RENAME COLUMN "ses_message_id" TO "provider_message_id";
  END IF;
END
$$;--> statement-breakpoint

DROP INDEX IF EXISTS "idx_email_sends_ses_message_id";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_sends_provider_message_id" ON "email_sends" USING btree ("provider_message_id");
