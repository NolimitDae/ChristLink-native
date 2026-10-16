# Security — native app and new database features

## What changed in this repo

| Area | Change |
|---|---|
| Secrets | No keys in source. All config is `EXPO_PUBLIC_*` env vars (publishable/anon keys only). Service-role keys exist only in Railway and Supabase Edge Function secrets. |
| Session storage | Supabase session kept in the iOS Keychain / Android Keystore via a chunked SecureStore adapter (`lib/supabase.ts`) — the stock adapter silently failed for sessions over 2 KB. |
| Payments | Card data never touches our code (Stripe PaymentSheet / CardField). Payment requests are not auto-retried. Publishable key only. |
| Network | 15 s timeouts; only idempotent GETs retry; non-JSON error pages handled. No tokens in URLs. |
| Logging | Structured logger, no `console.*`; Sentry with `sendDefaultPii: false`, user id only. |
| Deep links | Universal links / App Links limited to `christlinksocial.com/event/*` and `/church/*`. |
| Permissions | Asked in context with plain-language reasons (camera for check-in, location for Near me, notifications after onboarding explains why). Removed legacy Android storage permissions. |

## New tables (supabase/migrations/20261015000000_native_features.sql)

All new tables have RLS **enabled** with policies for the `authenticated` role scoped to `auth.uid()`:

| Table | Read | Write |
|---|---|---|
| `churches` | everyone (hidden ones: owner/admin) | insert: any signed-in user (trigger forces `verified=false`, `claimed_by=creator`); update: owner or admin; `verified`/`claimed_by`/`hidden` only changeable by admins (trigger) |
| `church_claims` | own or admin | own, status forced `pending`; decided via `decide_church_claim()` (admin only) |
| `church_follows`, `blocks`, `push_tokens`, `user_settings` | own | own |
| `church_recurring_events`, `church_events` | everyone | church owner or admin (event host checked with `is_event_host()`) |
| `verses` | active rows | admins only |
| `prayers` | **own only** — the wall is read through `get_prayer_wall()` which hides the author of anonymous prayers from everyone but the author | own; `prayed_count`, `hidden`, `answered_at` protected by a guard trigger |
| `prayer_prays` | own | only via `pray_for()` (one per user per prayer) |
| `serve_roles`, `serve_shifts` | everyone | event host / church owner who created them |
| `serve_signups` | own, or the role's organizer | own sign-up (capacity + start time checked in a trigger); volunteers can only cancel or re-join; check-in/complete via organizer RPCs |
| `reports` | own or admin | own insert; resolution via `resolve_report()` (admin only) |

Every `security definer` function sets `search_path = public` and checks the caller (`auth.uid()`, `is_admin()`,
organizer/author) before acting. `delete_my_account()` is revoked from `anon`.

### Foreign keys changed (review before applying)

To keep ticket and payment records when a person deletes their account (store requirement + legal retention):
`tickets.user_id`, `refund_requests.requester_id`, `ticket_checkins.checked_in_by`, `identity_verifications.reviewed_by`
now use `ON DELETE SET NULL` instead of cascading/blocking. `delete_my_account()` refuses while the user hosts upcoming
events with sold tickets, and for hosts with past sales it scrubs the profile and disables the login instead of
deleting the host record.

## Issues found in the existing backend (fix in ChristLink1 / Supabase)

1. **RLS policies on existing tables are attached to the `service_role` role only** (e.g. `profiles`, `events`,
   `rsvps`, `tickets`, `user_follows`). `service_role` bypasses RLS anyway, so these policies do nothing, and the
   `authenticated` role has no policies — clients can't read anything directly. This is safe (deny-by-default) as long
   as all access goes through the API, but the policies are misleading. Recreate them `TO authenticated` or drop them.
2. `community_posts` SELECT is open to `public` — fine for a public feed; confirm intended.
3. Host ID photos: confirm they live in a **private** bucket served only through short-lived signed URLs to admins
   and are deleted 30 days after a decision (plan Step 0.3). The native app only uploads through
   `/api/identity/submit` and only shows them to admins through `/api/admin/verifications/:id/id-doc`.
4. Free-ticket fee bug (`hostReceives: -30` at price 0) — see docs/PAYMENTS.md.
5. Add rate limits (if missing) on `/api/create-payment-intent`, `/api/charge-listing-fee`, sign-in OTP and uploads.

## Moderation

Report on posts, replies, forum messages, prayers, profiles, events and churches → `reports` → Admin → Reports
(oldest first, highlighted after 24 hours). Block hides that person's posts, prayers and messages everywhere in the app.

## Tests

Client-side checks are unit-tested (`__tests__/`). Ownership/admin checks for the new tables are enforced in SQL; test
them on a development project with two accounts:

1. Account A creates a prayer; account B cannot `select * from prayers` it directly (only via the wall RPC).
2. Account B cannot `update prayers set prayed_count = 999`.
3. Non-admin `select resolve_report(...)` → "Admins only".
4. Non-owner cannot insert `serve_roles` for someone else's event.
5. Anonymous prayer: B's `get_prayer_wall()` row has `author_id = null`.
