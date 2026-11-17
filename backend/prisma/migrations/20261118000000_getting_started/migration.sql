-- Getting started: the welcome tour after a new account's first sign-in and the setup checklist (docs/BACKEND.md)
ALTER TABLE "public"."user_settings" ADD COLUMN "welcomed_at" TIMESTAMPTZ(6);
ALTER TABLE "public"."user_settings" ADD COLUMN "setup_started_at" TIMESTAMPTZ(6);
ALTER TABLE "public"."user_settings" ADD COLUMN "setup_completed_at" TIMESTAMPTZ(6);
ALTER TABLE "public"."user_settings" ADD COLUMN "setup_hidden_at" TIMESTAMPTZ(6);
