ALTER TABLE "email_sends" ADD COLUMN "from_domain" text;--> statement-breakpoint
UPDATE "email_sends"
SET "from_domain" = split_part(
  CASE
    WHEN "from" ~ '<[^>]+>'
      THEN (regexp_match("from", '<([^>]+)>'))[1]
    ELSE "from"
  END,
  '@', 2
);--> statement-breakpoint
CREATE INDEX "idx_email_sends_from_domain" ON "email_sends" USING btree ("from_domain");
