# Developer review packet — payments, security and store readiness

For an outside developer (read-only repo access, Stripe **test** keys only, NDA). Budget 3–4 h after Phase 3 and
2–3 h before launch. They report problems; Claude Code fixes; they verify.

## 1. Payments (docs/PAYMENTS.md)
Brief: "Ticket sales work end to end in Stripe test mode … 7% attendee fee and tax shown as separate lines …
webhook plus confirm-by-intent fallback … refunds at host discretion … payouts to the host."
| Feature | Native files | API routes | Tests |
|---|---|---|---|
| Fee display | lib/fees.ts, components/event/CheckoutSheet.tsx | GET /api/price-breakdown, POST /api/tax-estimate | __tests__/lib/fees.test.ts |
| Purchase | components/event/CheckoutSheet.tsx | POST /api/create-payment-intent, /api/tickets/confirm-by-intent | api.test.ts (no retry, declined) |
| Coupons / listing fee | CheckoutSheet, app/event/create.tsx | /api/events/:id/validate-coupon, /api/validate-listing-promo, /api/charge-listing-fee | api-contract.test.ts |
| Refunds | app/ticket/[id].tsx, app/event/[id]/sales.tsx | /api/tickets/:id/request-refund, /api/refund-requests/:id/:action, /api/tickets/:id/refund | api-contract.test.ts, fees.test.ts |
| Payouts | app/host/payouts.tsx | /api/connect-onboard, /api/connect-sync | — |
Questions: (a) Is `create-payment-intent` idempotent per client request (Stripe idempotency key)? (b) Does the
webhook dedupe via `webhook_events` before confirming tickets? (c) What happens to a refund requested after the
connected account was paid out? (d) Fix `price=0` fee math. (e) Should tax be collected via Stripe Tax?

## 2. Security (docs/SECURITY.md)
| Area | Where |
|---|---|
| New RLS policies and SECURITY DEFINER RPCs | supabase/migrations/20261015000000_native_features.sql |
| FK changes to keep payment records on account deletion | same file, "Keep ticket, payment and moderation records" |
| Account deletion | `delete_my_account()`; app/settings/index.tsx |
| Session storage | lib/supabase.ts |
| Push dispatch | supabase/functions/push-dispatch/index.ts |
Questions: (a) Existing tables' policies are `TO service_role` (no-ops) — recreate for `authenticated` or drop?
(b) Are ID photos in a private bucket with signed URLs and 30-day deletion? (c) Any admin route that trusts a
client-supplied role? (d) Are `banned_until = infinity` + scrubbed email sufficient for hosts with sales history?

## 3. Store readiness
Account deletion, report/block, admin 24-hour queue, terms acceptance with version, 18+ host confirmation,
permission copy (app.json), demo account (docs/STORE.md), Median is **not** used — this is a native Expo app, so
the "plain website wrapper" rejection risk (Guideline 4.2) does not apply.

## Open items Claude couldn't finish (add here when a bug fails three fixes)
- Apple Wallet button hidden until the API offers a signed download link.
- Stripe balance / payout history endpoint does not exist.
