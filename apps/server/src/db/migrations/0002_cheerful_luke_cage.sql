ALTER TYPE "public"."email_event_type" ADD VALUE 'open';--> statement-breakpoint
ALTER TYPE "public"."email_event_type" ADD VALUE 'click';--> statement-breakpoint
ALTER TABLE "email_events" ADD COLUMN "metadata" jsonb;