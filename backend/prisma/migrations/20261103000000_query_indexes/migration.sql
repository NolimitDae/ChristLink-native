-- Indexes for the app's most common queries (feed, prayer wall, profiles, notifications, serve, follows).
-- IF NOT EXISTS so it is safe on databases that already carry an equivalent index from the Supabase era.

-- Community feed: newest first; a profile's posts
CREATE INDEX IF NOT EXISTS "idx_community_posts_created_at" ON "public"."community_posts" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_community_posts_author_id" ON "public"."community_posts" ("author_id");

-- Prayer wall: a profile's prayers, church filter; daily "N people prayed" summary scans the last 24 h of prays
CREATE INDEX IF NOT EXISTS "idx_prayers_author_id" ON "public"."prayers" ("author_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_prayers_church_id" ON "public"."prayers" ("church_id") WHERE "church_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_prayer_prays_created_at" ON "public"."prayer_prays" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_prayer_prays_user_id" ON "public"."prayer_prays" ("user_id");

-- Notifications inbox: one user's newest first
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "public"."notifications" ("user_id", "created_at" DESC);

-- Serve: shifts by role and time, a volunteer's sign-ups
CREATE INDEX IF NOT EXISTS "idx_serve_shifts_role_starts" ON "public"."serve_shifts" ("role_id", "starts_at");
CREATE INDEX IF NOT EXISTS "idx_serve_shifts_starts_at" ON "public"."serve_shifts" ("starts_at");
CREATE INDEX IF NOT EXISTS "idx_serve_signups_user_id" ON "public"."serve_signups" ("user_id");

-- Reverse lookups: who blocked me, which churches I follow, which churches list an event
CREATE INDEX IF NOT EXISTS "idx_blocks_blocked_id" ON "public"."blocks" ("blocked_id");
CREATE INDEX IF NOT EXISTS "idx_church_follows_user_id" ON "public"."church_follows" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_church_events_event_id" ON "public"."church_events" ("event_id");

-- Confirmed-RSVP counts per event (every event card and detail)
CREATE INDEX IF NOT EXISTS "idx_rsvps_event_confirmed" ON "public"."rsvps" ("event_id") WHERE "status" = 'confirmed';
