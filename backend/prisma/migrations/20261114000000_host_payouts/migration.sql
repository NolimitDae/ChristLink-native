-- Hosts are paid after their event: ticket money waits in the host's Stripe balance (manual payout schedule) and the
-- worker's host-payouts job pays each host's share once the event has ended. One row per Stripe payout; tickets point
-- at the payout that paid them, so nothing is paid twice.
CREATE TABLE "public"."host_payouts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "stripe_account_id" TEXT NOT NULL,
  "stripe_payout_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "host_payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "host_payouts_amount_check" CHECK ("amount_cents" > 0)
);

CREATE UNIQUE INDEX "host_payouts_stripe_payout_id_key" ON "public"."host_payouts"("stripe_payout_id");
CREATE INDEX "idx_host_payouts_user" ON "public"."host_payouts"("user_id", "created_at");

ALTER TABLE "public"."tickets" ADD COLUMN "payout_id" UUID;
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "public"."host_payouts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
-- Confirmed tickets still waiting for their host's payout
CREATE INDEX "idx_tickets_unpaid" ON "public"."tickets"("event_id") WHERE "payout_id" IS NULL AND "status" = 'confirmed';
