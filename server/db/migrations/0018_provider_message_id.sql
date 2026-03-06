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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_sends'
      AND indexname = 'idx_email_sends_ses_message_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_sends'
      AND indexname = 'idx_email_sends_provider_message_id'
  ) THEN
    ALTER INDEX "idx_email_sends_ses_message_id" RENAME TO "idx_email_sends_provider_message_id";
  END IF;
END
$$;
