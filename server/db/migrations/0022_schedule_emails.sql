ALTER TYPE "public"."email_status" ADD VALUE IF NOT EXISTS 'scheduled';--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp;
