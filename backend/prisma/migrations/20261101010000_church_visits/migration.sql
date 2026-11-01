-- "Plan a visit" connect cards: a first-time visitor tells a church which service they're coming to.
-- The church owner (claimed_by) and admins see upcoming visits; email is shared only when share_contact is true.
CREATE TABLE "public"."church_visits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "church_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "visit_at" TIMESTAMPTZ(6) NOT NULL,
  "service_label" TEXT,
  "party_size" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "share_contact" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "church_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "church_visits_party_size_check" CHECK ("party_size" BETWEEN 1 AND 20)
);

CREATE UNIQUE INDEX "church_visits_church_id_user_id_visit_at_key" ON "public"."church_visits"("church_id", "user_id", "visit_at");
CREATE INDEX "idx_church_visits_upcoming" ON "public"."church_visits"("church_id", "visit_at");

ALTER TABLE "public"."church_visits" ADD CONSTRAINT "church_visits_church_id_fkey"
  FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."church_visits" ADD CONSTRAINT "church_visits_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
