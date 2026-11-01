-- The website's event_waitlist table (event_id, user_id, created_at, notified_at) gains a status so the API can run
-- the queue: waiting → promoted (free event: an RSVP was made for them) | notified (paid: told a ticket came back) | left.
-- Existing rows stay in line as 'waiting'.
ALTER TABLE "public"."event_waitlist" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'waiting';
ALTER TABLE "public"."event_waitlist" ADD CONSTRAINT "event_waitlist_status_check"
  CHECK ("status" IN ('waiting', 'promoted', 'notified', 'left'));
CREATE INDEX "idx_event_waitlist_queue" ON "public"."event_waitlist"("event_id", "status", "created_at");
