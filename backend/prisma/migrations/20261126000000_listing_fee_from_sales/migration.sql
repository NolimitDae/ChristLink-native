-- Listing fee taken from ticket sales instead of charged by card in the app (App Store Guideline 3.1.1; docs/PAYMENTS.md)
-- events.listing_fee_owed_cents: what is still to be taken from this event's ticket sales
-- tickets.listing_fee_cents: the part of this ticket's platform share that goes toward the listing fee
ALTER TABLE "public"."events" ADD COLUMN "listing_fee_owed_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."tickets" ADD COLUMN "listing_fee_cents" INTEGER NOT NULL DEFAULT 0;
