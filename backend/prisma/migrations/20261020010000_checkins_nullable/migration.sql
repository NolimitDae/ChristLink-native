-- checked_in_by is ON DELETE SET NULL, so it must allow NULL or deleting a host account fails
ALTER TABLE "public"."ticket_checkins" ALTER COLUMN "checked_in_by" DROP NOT NULL;
