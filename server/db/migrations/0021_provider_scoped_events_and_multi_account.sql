ALTER TABLE "email_sends" ADD COLUMN IF NOT EXISTS "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN IF NOT EXISTS "provider_type" text;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN IF NOT EXISTS "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN IF NOT EXISTS "provider_type" text;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_sends_provider_id_providers_id_fk'
  ) THEN
    ALTER TABLE "email_sends"
      ADD CONSTRAINT "email_sends_provider_id_providers_id_fk"
      FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_events_provider_id_providers_id_fk'
  ) THEN
    ALTER TABLE "email_events"
      ADD CONSTRAINT "email_events_provider_id_providers_id_fk"
      FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END
$$;--> statement-breakpoint

UPDATE "email_sends" es
SET
  "provider_id" = ei."provider_id",
  "provider_type" = p."name"
FROM "email_identities" ei
LEFT JOIN "providers" p ON p."id" = ei."provider_id"
WHERE es."provider_id" IS NULL
  AND es."from_domain" IS NOT NULL
  AND ei."domain" = es."from_domain";--> statement-breakpoint

UPDATE "email_events" ee
SET
  "provider_id" = es."provider_id",
  "provider_type" = es."provider_type"
FROM "email_sends" es
WHERE ee."provider_id" IS NULL
  AND ee."email_send_id" = es."id";--> statement-breakpoint

ALTER TABLE "providers" DROP CONSTRAINT IF EXISTS "providers_name_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "providers_name_unique";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_email_sends_provider_id" ON "email_sends" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_sends_provider_type" ON "email_sends" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_sends_provider_id_message_id" ON "email_sends" USING btree ("provider_id", "provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_sends_provider_type_message_id" ON "email_sends" USING btree ("provider_type", "provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_events_provider_id_message_id" ON "email_events" USING btree ("provider_id", "provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_events_provider_type_message_id" ON "email_events" USING btree ("provider_type", "provider_message_id");
