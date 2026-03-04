ALTER TYPE "public"."email_event_type" ADD VALUE 'queued' BEFORE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."email_event_type" ADD VALUE 'suppressed' BEFORE 'submitted';--> statement-breakpoint
ALTER TABLE "email_events" ALTER COLUMN "ses_message_id" DROP NOT NULL;