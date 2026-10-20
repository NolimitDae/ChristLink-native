-- Baseline: the production Supabase public schema + native-feature tables, without Supabase-only parts
-- (RLS, policies, grants, auth.* functions/triggers, views, pg_cron). Generated from prod_schema.sql and
-- supabase/migrations/20261015000000_native_features.sql; see docs/RPC-PORTING.md for what was dropped.

-- Scaffold table from the init migration, never used
DROP TABLE IF EXISTS "User";

CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";

-- Replaces Supabase auth.users (same ids)
CREATE TABLE "public"."users" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "last_sign_in_at" timestamp with time zone,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE TABLE "public"."refresh_tokens" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "token_hash" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "replaced_by" uuid,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens" ("user_id");

-- ── Production tables, keys, indexes, foreign keys ──

CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "total_charged_cents" integer NOT NULL,
    "platform_fee_cents" integer NOT NULL,
    "stripe_fee_cents" integer NOT NULL,
    "host_receives_cents" integer NOT NULL,
    "stripe_payment_intent" "text",
    "stripe_idempotency_key" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "buyer_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "confirmed_at" timestamp with time zone,
    "code" "text",
    "coupon_id" "uuid",
    "discount_cents" integer DEFAULT 0,
    "promoter_id" "uuid",
    CONSTRAINT "tickets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'refunded'::"text", 'failed'::"text", 'disputed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "city" "text",
    "role" "text" DEFAULT 'attendee'::"text",
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_color" "text",
    "instagram_url" "text",
    "facebook_url" "text",
    "tiktok_url" "text",
    "banner_url" "text",
    "bible_verse" "text",
    "bible_verse_reference" "text",
    "bible_version" "text" DEFAULT 'NIV'::"text",
    "hot_takes" "text",
    "hobbies" "text",
    "connect_tags" "text"[] DEFAULT '{}'::"text"[],
    "avatar_ring_color" "text",
    "prayer_request" "text",
    "testimony" "text",
    "prayer_supporters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "identity_verified" boolean DEFAULT false,
    "identity_verified_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['attendee'::"text", 'host'::"text", 'admin'::"text", 'verified'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "host_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "emoji" "text" DEFAULT '✝'::"text",
    "event_type" "text",
    "age_group" "text" DEFAULT 'All Ages'::"text",
    "format" "text" DEFAULT 'in_person'::"text",
    "denomination" "text",
    "tags" "text"[],
    "is_paid" boolean DEFAULT false,
    "listing_fee_paid" boolean DEFAULT false,
    "listing_payment_id" "text",
    "absorb_stripe_fee" boolean DEFAULT true,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "venue_name" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "online_url" "text",
    "max_capacity" integer,
    "status" "text" DEFAULT 'draft'::"text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cover_url" "text",
    "gallery_urls" "text"[] DEFAULT '{}'::"text"[],
    "forum_enabled" boolean DEFAULT false NOT NULL,
    "publish_at" timestamp with time zone,
    "lat" double precision,
    "lng" double precision,
    "rsvp_count" integer DEFAULT 0 NOT NULL,
    "sales_cutoff" timestamp with time zone,
    "requires_approval" boolean DEFAULT false NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "events_format_check" CHECK (("format" = ANY (ARRAY['in_person'::"text", 'online'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'cancelled'::"text", 'completed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."rsvps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "promoter_id" "uuid",
    "note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rsvps_status_check" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."community_post_amens" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "amen_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reply_count" integer DEFAULT 0 NOT NULL,
    "reaction_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."community_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "amen_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_replies_body_check" CHECK (("char_length"("body") <= 500))
);

CREATE TABLE IF NOT EXISTS "public"."community_reply_amens" (
    "reply_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" integer NOT NULL,
    "max_uses" integer,
    "uses" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "coupons_discount_value_check" CHECK (("discount_value" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."event_forum_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."event_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "audience" "text" DEFAULT 'going'::"text" NOT NULL,
    "recipients_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_messages_audience_check" CHECK (("audience" = ANY (ARRAY['going'::"text", 'waitlist'::"text", 'all'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."event_promoters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "user_id" "uuid",
    "clicks" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."event_waitlist" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."ticket_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'General Admission'::"text" NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "quantity" integer,
    "sold" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sales_start" timestamp with time zone,
    "sales_end" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."host_stripe_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "onboarding_complete" boolean DEFAULT false,
    "payouts_enabled" boolean DEFAULT false,
    "charges_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."identity_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "legal_name" "text" NOT NULL,
    "id_doc_path" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified_at" timestamp with time zone,
    "rejected_reason" "text",
    "reviewed_by" "uuid",
    CONSTRAINT "identity_verifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."listing_promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listing_promo_codes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "listing_promo_codes_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_reactions_emoji_check" CHECK (("emoji" = ANY (ARRAY['🙏'::"text", '❤️'::"text", '🔥'::"text", '😢'::"text", '🙌'::"text", '✝️'::"text", '💪'::"text", '🕊️'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "identifier" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "host_id" "uuid" NOT NULL,
    "reason" "text",
    "amount_cents" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "uuid",
    CONSTRAINT "refund_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ticket_checkins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "checked_in_by" "uuid" NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "no_self_follow" CHECK (("follower_id" <> "following_id"))
);

CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."community_post_amens"
    ADD CONSTRAINT "community_post_amens_pkey" PRIMARY KEY ("post_id", "user_id");

ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."community_replies"
    ADD CONSTRAINT "community_replies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."community_reply_amens"
    ADD CONSTRAINT "community_reply_amens_pkey" PRIMARY KEY ("reply_id", "user_id");

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_event_id_code_key" UNIQUE ("event_id", "code");

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_forum_posts"
    ADD CONSTRAINT "event_forum_posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_messages"
    ADD CONSTRAINT "event_messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_promoters"
    ADD CONSTRAINT "event_promoters_event_id_code_key" UNIQUE ("event_id", "code");

ALTER TABLE ONLY "public"."event_promoters"
    ADD CONSTRAINT "event_promoters_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_event_id_user_id_key" UNIQUE ("event_id", "user_id");

ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."host_stripe_accounts"
    ADD CONSTRAINT "host_stripe_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."host_stripe_accounts"
    ADD CONSTRAINT "host_stripe_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");

ALTER TABLE ONLY "public"."host_stripe_accounts"
    ADD CONSTRAINT "host_stripe_accounts_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."listing_promo_codes"
    ADD CONSTRAINT "listing_promo_codes_code_key" UNIQUE ("code");

ALTER TABLE ONLY "public"."listing_promo_codes"
    ADD CONSTRAINT "listing_promo_codes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_user_id_key" UNIQUE ("post_id", "user_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_ticket_id_key" UNIQUE ("ticket_id");

ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_user_id_key" UNIQUE ("event_id", "user_id");

ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ticket_checkins"
    ADD CONSTRAINT "ticket_checkins_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ticket_checkins"
    ADD CONSTRAINT "ticket_checkins_ticket_id_key" UNIQUE ("ticket_id");

ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_stripe_idempotency_key_key" UNIQUE ("stripe_idempotency_key");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_stripe_payment_intent_key" UNIQUE ("stripe_payment_intent");

ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");

ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");

CREATE INDEX "coupons_code_idx" ON "public"."coupons" USING "btree" ("event_id", "code");

CREATE INDEX "coupons_event_id_idx" ON "public"."coupons" USING "btree" ("event_id");

CREATE INDEX "event_forum_posts_event_id_idx" ON "public"."event_forum_posts" USING "btree" ("event_id", "created_at");

CREATE INDEX "event_messages_event_idx" ON "public"."event_messages" USING "btree" ("event_id", "created_at" DESC);

CREATE INDEX "event_promoters_event_idx" ON "public"."event_promoters" USING "btree" ("event_id");

CREATE INDEX "event_waitlist_event_idx" ON "public"."event_waitlist" USING "btree" ("event_id", "created_at");

CREATE INDEX "events_city_idx" ON "public"."events" USING "btree" ("city");

CREATE INDEX "events_date_idx" ON "public"."events" USING "btree" ("start_date");

CREATE INDEX "events_name_trgm" ON "public"."events" USING "gin" ("name" "public"."gin_trgm_ops");

CREATE INDEX "events_status_idx" ON "public"."events" USING "btree" ("status");

CREATE INDEX "events_type_idx" ON "public"."events" USING "btree" ("event_type");

CREATE INDEX "idx_events_host_id" ON "public"."events" USING "btree" ("host_id");

CREATE INDEX "idx_events_start_date" ON "public"."events" USING "btree" ("start_date");

CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");

CREATE INDEX "idx_follows_follower" ON "public"."user_follows" USING "btree" ("follower_id");

CREATE INDEX "idx_follows_following" ON "public"."user_follows" USING "btree" ("following_id");

CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");

CREATE INDEX "idx_notifications_user_read" ON "public"."notifications" USING "btree" ("user_id", "read");

CREATE INDEX "idx_rate_limits_lookup" ON "public"."rate_limits" USING "btree" ("identifier", "action", "created_at");

CREATE INDEX "idx_refund_requests_event_id" ON "public"."refund_requests" USING "btree" ("event_id");

CREATE INDEX "idx_refund_requests_host_id" ON "public"."refund_requests" USING "btree" ("host_id");

CREATE INDEX "idx_refund_requests_requester_id" ON "public"."refund_requests" USING "btree" ("requester_id");

CREATE INDEX "idx_refund_requests_status" ON "public"."refund_requests" USING "btree" ("status");

CREATE INDEX "idx_rsvps_event_id" ON "public"."rsvps" USING "btree" ("event_id");

CREATE INDEX "idx_rsvps_user_id" ON "public"."rsvps" USING "btree" ("user_id");

CREATE INDEX "idx_ticket_types_event_id" ON "public"."ticket_types" USING "btree" ("event_id");

CREATE INDEX "idx_tickets_event_id" ON "public"."tickets" USING "btree" ("event_id");

CREATE INDEX "idx_tickets_status" ON "public"."tickets" USING "btree" ("status");

CREATE INDEX "idx_tickets_user_id" ON "public"."tickets" USING "btree" ("user_id");

CREATE INDEX "idx_webhook_events_created_at" ON "public"."webhook_events" USING "btree" ("created_at");

CREATE INDEX "reactions_post_id_idx" ON "public"."post_reactions" USING "btree" ("post_id");

CREATE INDEX "reactions_user_id_idx" ON "public"."post_reactions" USING "btree" ("user_id");

CREATE INDEX "replies_created_idx" ON "public"."community_replies" USING "btree" ("created_at");

CREATE INDEX "replies_post_id_idx" ON "public"."community_replies" USING "btree" ("post_id");

ALTER TABLE ONLY "public"."community_post_amens"
    ADD CONSTRAINT "community_post_amens_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_post_amens"
    ADD CONSTRAINT "community_post_amens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_replies"
    ADD CONSTRAINT "community_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_replies"
    ADD CONSTRAINT "community_replies_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_reply_amens"
    ADD CONSTRAINT "community_reply_amens_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."community_replies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."community_reply_amens"
    ADD CONSTRAINT "community_reply_amens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_forum_posts"
    ADD CONSTRAINT "event_forum_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_forum_posts"
    ADD CONSTRAINT "event_forum_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_messages"
    ADD CONSTRAINT "event_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_messages"
    ADD CONSTRAINT "event_messages_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_promoters"
    ADD CONSTRAINT "event_promoters_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_promoters"
    ADD CONSTRAINT "event_promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_waitlist"
    ADD CONSTRAINT "event_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."host_stripe_accounts"
    ADD CONSTRAINT "host_stripe_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_promoter_fk" FOREIGN KEY ("promoter_id") REFERENCES "public"."event_promoters"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ticket_checkins"
    ADD CONSTRAINT "ticket_checkins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."ticket_checkins"
    ADD CONSTRAINT "ticket_checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ticket_checkins"
    ADD CONSTRAINT "ticket_checkins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."event_promoters"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");

ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

-- ── Native-feature tables and changes to existing tables ──

alter table public.tickets alter column user_id drop not null;

alter table public.tickets drop constraint if exists tickets_user_id_fkey;

alter table public.tickets add constraint tickets_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.refund_requests alter column requester_id drop not null;

alter table public.refund_requests drop constraint if exists refund_requests_requester_id_fkey;

alter table public.refund_requests add constraint refund_requests_requester_id_fkey
  foreign key (requester_id) references public.users(id) on delete set null;

alter table public.ticket_checkins drop constraint if exists ticket_checkins_checked_in_by_fkey;

alter table public.ticket_checkins add constraint ticket_checkins_checked_in_by_fkey
  foreign key (checked_in_by) references public.profiles(id) on delete set null;

alter table public.identity_verifications drop constraint if exists identity_verifications_reviewed_by_fkey;

alter table public.identity_verifications add constraint identity_verifications_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

alter table public.community_posts add column if not exists post_type text
  check (post_type in ('prayer', 'praise', 'testimony', 'encouragement', 'answered'));

alter table public.community_posts add column if not exists prayer_id uuid;

create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  denomination text,
  address text,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  service_times jsonb not null default '[]'::jsonb,
  livestream_url text,
  website_url text,
  leaders jsonb not null default '[]'::jsonb,
  photos text[] not null default '{}',
  logo_url text,
  about text,
  verified boolean not null default false,
  claimed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists churches_name_idx on public.churches using gin (to_tsvector('simple', name || ' ' || coalesce(city, '')));

create table if not exists public.church_claims (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_at_church text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create table if not exists public.church_follows (
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (church_id, user_id)
);

create table if not exists public.church_events (
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (church_id, event_id)
);

create table if not exists public.church_recurring_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  event_type text,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  weekday smallint check (weekday between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  start_time time not null,
  duration_minutes integer not null default 90 check (duration_minutes between 15 and 1440),
  starts_on date not null default current_date,
  ends_on date,
  location text,
  is_service boolean not null default false,
  created_at timestamptz not null default now(),
  check ((frequency = 'monthly' and day_of_month is not null) or (frequency <> 'monthly' and weekday is not null))
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  home_church_id uuid references public.churches(id) on delete set null,
  hide_rsvps_from_non_friends boolean not null default false,
  notification_prefs jsonb not null default '{}'::jsonb,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  timezone text,
  terms_version text,
  terms_accepted_at timestamptz,
  host_adult_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

create table if not exists public.verses (
  id serial primary key,
  reference text not null,
  text text not null,
  translation text not null default 'WEB',
  themes text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.verses (reference, text, themes) values
  ('Psalm 46:10', 'Be still, and know that I am God.', '{prayer,worship}'),
  ('Matthew 18:20', 'For where two or three are gathered together in my name, there I am in the middle of them.', '{fellowship,community,bible study}'),
  ('Philippians 4:6', 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.', '{prayer}'),
  ('Psalm 95:1', 'Oh come, let''s sing to Yahweh. Let''s shout aloud to the rock of our salvation!', '{worship,concert}'),
  ('Hebrews 10:24', 'Let''s consider how to provoke one another to love and good works.', '{community,fellowship,outreach}'),
  ('Psalm 119:105', 'Your word is a lamp to my feet, and a light for my path.', '{bible study}'),
  ('Isaiah 40:31', 'But those who wait for Yahweh will renew their strength. They will mount up with wings like eagles.', '{retreat,prayer}'),
  ('1 Timothy 4:12', 'Let no man despise your youth; but be an example to those who believe, in word, in your way of life, in love, in spirit, in faith, and in purity.', '{youth}'),
  ('Matthew 5:16', 'Even so, let your light shine before men, that they may see your good works, and glorify your Father who is in heaven.', '{outreach,community}'),
  ('Colossians 3:16', 'Let the word of Christ dwell in you richly; in all wisdom teaching and admonishing one another with psalms, hymns, and spiritual songs.', '{worship,bible study,concert}'),
  ('Psalm 133:1', 'See how good and how pleasant it is for brothers to live together in unity!', '{fellowship,community}'),
  ('Mark 6:31', 'Come away into a deserted place, and rest awhile.', '{retreat}'),
  ('Proverbs 27:17', 'Iron sharpens iron; so a man sharpens his friend''s countenance.', '{fellowship,youth,conference}'),
  ('Galatians 6:2', 'Bear one another''s burdens, and so fulfill the law of Christ.', '{prayer,community,outreach}'),
  ('Romans 12:12', 'Rejoicing in hope, enduring in troubles, continuing steadfastly in prayer.', '{prayer}'),
  ('Lamentations 3:22-23', 'His compassion doesn''t fail. They are new every morning. Great is your faithfulness.', '{}'),
  ('John 13:35', 'By this everyone will know that you are my disciples, if you have love for one another.', '{community,fellowship}'),
  ('Joshua 1:9', 'Be strong and courageous. Don''t be afraid. Don''t be dismayed, for Yahweh your God is with you wherever you go.', '{youth,conference}'),
  ('Psalm 100:2', 'Serve Yahweh with gladness. Come before his presence with singing.', '{worship,outreach}'),
  ('Acts 2:42', 'They continued steadfastly in the apostles'' teaching and fellowship, in the breaking of bread, and prayer.', '{bible study,fellowship}'),
  ('2 Timothy 3:16', 'Every Scripture is God-breathed and profitable for teaching, for reproof, for correction, and for instruction in righteousness.', '{bible study,conference}'),
  ('1 Peter 4:10', 'As each has received a gift, employ it in serving one another, as good managers of the grace of God.', '{outreach}'),
  ('Zephaniah 3:17', 'Yahweh your God is among you, a mighty one who will save. He will rejoice over you with joy.', '{worship}'),
  ('Psalm 23:1', 'Yahweh is my shepherd; I shall lack nothing.', '{retreat}'),
  ('Matthew 11:28', 'Come to me, all you who labor and are heavily burdened, and I will give you rest.', '{retreat,prayer}'),
  ('Ephesians 4:2-3', 'With all lowliness and humility, with patience, bearing with one another in love; being eager to keep the unity of the Spirit.', '{community}'),
  ('Jeremiah 29:11', 'For I know the thoughts that I think toward you, says Yahweh, thoughts of peace, and not of evil, to give you hope and a future.', '{youth}'),
  ('Psalm 150:6', 'Let everything that has breath praise Yah! Praise Yah!', '{worship,concert}'),
  ('James 5:16', 'Pray for one another, that you may be healed. The insistent prayer of a righteous person is powerfully effective.', '{prayer}'),
  ('Romans 15:13', 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope.', '{}'),
  ('Micah 6:8', 'What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?', '{outreach,conference}')
on conflict do nothing;

create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1000),
  is_anonymous boolean not null default false,
  church_id uuid references public.churches(id) on delete set null,
  prayed_count integer not null default 0,
  answered_at timestamptz,
  testimony text check (testimony is null or char_length(testimony) <= 2000),
  testimony_post_id uuid references public.community_posts(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists prayers_created_idx on public.prayers(created_at desc) where not hidden;

create table if not exists public.prayer_prays (
  prayer_id uuid not null references public.prayers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prayer_id, user_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.serve_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  church_id uuid references public.churches(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text,
  requirements text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (event_id is not null or church_id is not null)
);

create table if not exists public.serve_shifts (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.serve_roles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  spots integer not null check (spots between 1 and 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.serve_signups (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.serve_shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'signed_up' check (status in ('signed_up', 'checked_in', 'completed', 'cancelled', 'no_show')),
  code text not null default upper(substr(md5(random()::text), 1, 8)),
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shift_id, user_id),
  unique (code)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'reply', 'forum_message', 'prayer', 'profile', 'event', 'church')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'false_info', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_open_idx on public.reports(created_at) where status = 'open';

-- ── Functions kept (no auth.* dependency) and plain updated_at triggers ──

CREATE OR REPLACE FUNCTION "public"."adjust_post_amen_count"("p_post_id" "uuid", "p_delta" integer) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  UPDATE community_posts
  SET amen_count = GREATEST(COALESCE(amen_count, 0) + p_delta, 0)
  WHERE id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION "public"."adjust_reply_amen_count"("p_reply_id" "uuid", "p_delta" integer) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  UPDATE community_replies
  SET amen_count = GREATEST(COALESCE(amen_count, 0) + p_delta, 0)
  WHERE id = p_reply_id;
$$;

CREATE OR REPLACE FUNCTION "public"."approve_rsvp"("p_rsvp_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare v_r record; v_cap integer; v_taken integer;
begin
  select * into v_r from rsvps where id = p_rsvp_id;
  if v_r.id is null or v_r.status <> 'pending' then return 'not_pending'; end if;
  select max_capacity into v_cap from events where id = v_r.event_id for update;
  if v_cap is not null then
    select (select count(*) from rsvps where event_id = v_r.event_id and status = 'confirmed')
         + coalesce((select sum(quantity) from tickets where event_id = v_r.event_id and status = 'confirmed'), 0) into v_taken;
    if v_taken >= v_cap then return 'full'; end if;
  end if;
  update rsvps set status = 'confirmed', updated_at = now() where id = p_rsvp_id;
  return 'confirmed';
end $$;

CREATE OR REPLACE FUNCTION "public"."clean_old_rate_limits"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  delete from public.rate_limits where created_at < now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION "public"."increment_event_views"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update events set view_count = view_count + 1 where id = p_event_id; $$;

CREATE OR REPLACE FUNCTION "public"."increment_promoter_clicks"("p_promoter_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  update event_promoters set clicks = clicks + 1 where id = p_promoter_id; $$;

CREATE OR REPLACE FUNCTION "public"."increment_tickets_sold"("p_ticket_type_id" "uuid", "p_qty" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin update ticket_types set sold = greatest(0, sold + p_qty) where id = p_ticket_type_id; end $$;

CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."upsert_post_reaction"("p_post_id" "uuid", "p_user_id" "uuid", "p_emoji" "text") RETURNS TABLE("action" "text", "emoji" "text", "total_count" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing TEXT;
  v_action   TEXT;
BEGIN
  SELECT pr.emoji INTO v_existing
  FROM public.post_reactions pr
  WHERE pr.post_id = p_post_id AND pr.user_id = p_user_id;

  IF v_existing IS NULL THEN
    INSERT INTO public.post_reactions(post_id, user_id, emoji)
    VALUES (p_post_id, p_user_id, p_emoji);
    UPDATE public.community_posts
    SET reaction_count = reaction_count + 1
    WHERE id = p_post_id;
    v_action := 'added';

  ELSIF v_existing = p_emoji THEN
    DELETE FROM public.post_reactions
    WHERE post_id = p_post_id AND user_id = p_user_id;
    UPDATE public.community_posts
    SET reaction_count = GREATEST(0, reaction_count - 1)
    WHERE id = p_post_id;
    v_action := 'removed';

  ELSE
    UPDATE public.post_reactions
    SET emoji = p_emoji
    WHERE post_id = p_post_id AND user_id = p_user_id;
    v_action := 'changed';
  END IF;

  RETURN QUERY
    SELECT
      v_action,
      p_emoji,
      (SELECT COUNT(*) FROM public.post_reactions WHERE post_id = p_post_id);
END;
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.user_follows where follower_id = a and following_id = b)
     and exists (select 1 from public.user_follows where follower_id = b and following_id = a);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.verse_of_the_day(p_theme text default null)
returns table (id integer, reference text, text text, translation text)
language plpgsql stable set search_path = public as $$
declare
  n integer;
  day_index integer := (current_date - date '2026-01-01');
begin
  if p_theme is not null then
    select count(*) into n from public.verses v where v.active and lower(p_theme) = any (v.themes);
    if n > 0 then
      return query select v.id, v.reference, v.text, v.translation from public.verses v
        where v.active and lower(p_theme) = any (v.themes)
        order by v.id offset (abs(day_index) % n) limit 1;
      return;
    end if;
  end if;
  select count(*) into n from public.verses v where v.active;
  if n = 0 then return; end if;
  return query select v.id, v.reference, v.text, v.translation from public.verses v
    where v.active order by v.id offset (abs(day_index) % n) limit 1;
end $$;

create or replace function public.serve_shift_counts(p_shift_ids uuid[])
returns table (shift_id uuid, taken integer)
language sql stable set search_path = public as $$
  select s.shift_id, count(*)::integer from public.serve_signups s
   where s.shift_id = any (p_shift_ids) and s.status in ('signed_up', 'checked_in', 'completed')
   group by s.shift_id;
$$;

CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "update_host_accounts_updated_at" BEFORE UPDATE ON "public"."host_stripe_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

create trigger churches_touch before update on public.churches for each row execute function public.touch_updated_at();

create trigger user_settings_touch before update on public.user_settings for each row execute function public.touch_updated_at();

CREATE TRIGGER "users_touch" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();
