-- Reposts: a member shares an event that is listed on another platform (Eventbrite, a church site, a flyer).
-- It is an ordinary event row (so lists, search, "I'm going" RSVPs, the forum, reports and admin all work) with
-- is_repost = true: host_id is the member who shared it, organizer_name is who actually hosts it, and the links
-- point at the original listing and its tickets / RSVP page. Reposts are never ticketed here.
ALTER TABLE "public"."events" ADD COLUMN "is_repost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."events" ADD COLUMN "source_url" TEXT;
ALTER TABLE "public"."events" ADD COLUMN "ticket_url" TEXT;
ALTER TABLE "public"."events" ADD COLUMN "organizer_name" TEXT;
-- Finding an existing repost of the same listing
CREATE INDEX "idx_events_repost_source" ON "public"."events"("source_url") WHERE "is_repost" = true;
