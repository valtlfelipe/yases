CREATE TYPE "public"."identity_status" AS ENUM('pending', 'verified', 'failed', 'temporarily_failed');--> statement-breakpoint
CREATE TABLE "email_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"status" "identity_status" DEFAULT 'pending' NOT NULL,
	"dkim_tokens" text[],
	"dkim_status" text,
	"mail_from_domain" text,
	"raw_attributes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_identities_domain_unique" UNIQUE("domain")
);
