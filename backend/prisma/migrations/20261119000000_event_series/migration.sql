-- Repeating free events (docs/RECURRING.md): a series row holds the rule; each date is its own events row
CREATE TABLE "public"."event_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "anchor_start" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER,
    "until" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "event_series_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_series_rule_check" CHECK ("rule" IN ('weekly', 'biweekly', 'monthly')),
    CONSTRAINT "event_series_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "idx_event_series_active" ON "public"."event_series"("created_at") WHERE "ended_at" IS NULL;

ALTER TABLE "public"."events" ADD COLUMN "series_id" UUID;
ALTER TABLE "public"."events" ADD COLUMN "series_index" INTEGER;
ALTER TABLE "public"."events" ADD CONSTRAINT "events_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
-- One row per date of a series, so two workers adding dates at once can't make duplicates
CREATE UNIQUE INDEX "events_series_index_key" ON "public"."events"("series_id", "series_index") WHERE "series_id" IS NOT NULL;
