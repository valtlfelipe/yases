-- Backfill email status from existing events.
-- Applied in ascending priority so higher-priority events always win:
--   delivery → 'delivered', open → 'opened', complaint → 'complained'

UPDATE email_sends
SET status = 'delivered'
WHERE status NOT IN ('delivered', 'opened', 'complained', 'bounced', 'failed', 'suppressed')
  AND EXISTS (
    SELECT 1 FROM email_events
    WHERE email_events.email_send_id = email_sends.id
      AND email_events.event_type = 'delivery'
  );
--> statement-breakpoint

UPDATE email_sends
SET status = 'opened'
WHERE status NOT IN ('opened', 'complained', 'bounced', 'failed', 'suppressed')
  AND EXISTS (
    SELECT 1 FROM email_events
    WHERE email_events.email_send_id = email_sends.id
      AND email_events.event_type = 'open'
  );
--> statement-breakpoint

UPDATE email_sends
SET status = 'complained'
WHERE status NOT IN ('complained', 'bounced', 'failed', 'suppressed')
  AND EXISTS (
    SELECT 1 FROM email_events
    WHERE email_events.email_send_id = email_sends.id
      AND email_events.event_type = 'complaint'
  );
