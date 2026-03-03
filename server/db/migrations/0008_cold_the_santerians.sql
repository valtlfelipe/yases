CREATE INDEX "idx_apikey_key" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_email_events_event_type" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_email_events_occurred_at" ON "email_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_email_sends_status" ON "email_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_sends_created_at" ON "email_sends" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_sends_to" ON "email_sends" USING btree ("to");--> statement-breakpoint
CREATE INDEX "idx_email_sends_job_id" ON "email_sends" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_email_sends_ses_message_id" ON "email_sends" USING btree ("ses_message_id");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");