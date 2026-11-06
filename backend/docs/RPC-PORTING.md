# Supabase SQL that the baseline migration dropped

`prisma/migrations/20261020000000_baseline` recreates the production `public` tables, keys, indexes and foreign
keys plus the native-feature tables, but drops everything that only works inside Supabase (RLS, policies, grants,
`auth.uid()` / `auth.role()` / `auth.users`, views, pg_cron, publication). Port each item below to TypeScript in
the module that owns it. Source: `C:\Users\David\prod_schema.sql` and
`supabase/migrations/20261015000000_native_features.sql` (read them for the exact SQL).

Authorization that RLS used to do (owner-only rows, host-only, admin-only) now lives in the services: check
`req.user.id` against the row's owner column, and use `@Admin()` for admin routes.

## Dropped functions (RPCs and helpers)

| Function | What it did | Route / owner |
|---|---|---|
| `handle_new_user()` (trigger on auth.users) | Inserted `profiles (id, email, full_name = signup full_name or email local part)` | Done: `AuthService.findOrCreateUser` |
| `guard_profile_privileged_columns()` (trigger) | Non-service callers could not change `profiles.role`, `identity_verified`, `identity_verified_at`, `email` | Profile update service: whitelist editable fields |
| `guard_event_privileged_columns()` (trigger) | Non-service callers could not change `events.listing_fee_paid`, `listing_payment_id`, `host_id` | Events update service: whitelist editable fields |
| `is_admin()` | `profiles.role = 'admin'` for `auth.uid()` | Done: `AdminGuard` / `@Admin()` |
| `is_event_host(event_id)` | Event's `host_id = auth.uid()` | Check in services |
| `churches_guard()` (trigger) | Non-admins: on insert force `verified=false, created_by=claimed_by=caller, hidden=false`; on update keep `verified, claimed_by, created_by, hidden` | `POST/PATCH /api/churches` |
| `decide_church_claim(claim_id, approve)` | Admin: set claim status/decided_by/decided_at; on approve set church `claimed_by` + `verified=true`; notify claimant (`church_claim`) | `POST /api/admin/church-claims/:id/decide` |
| `verify_church(church_id, verified)` | Admin: set `churches.verified` | admin churches |
| `prayers_guard()` (trigger) | Authors could not change `prayed_count, hidden, answered_at, testimony_post_id, author_id` | `PATCH` prayer routes |
| `get_prayer_wall(filter, limit, before)` | Prayer feed with `has_prayed, is_mine, is_friend`, author fields nulled for anonymous prayers of others, hides blocked authors; filters all/answered/mine/friends/church (home church from user_settings); limit 1–100 | `GET /api/prayers` |
| `pray_for(prayer_id)` | Insert `prayer_prays` (once per user); if new, `prayed_count + 1`; returns count | `POST /api/prayers/:id/pray` |
| `mark_prayer_answered(prayer_id, testimony)` | Author only; testimony ≥ 3 chars; creates `community_posts (post_type='answered', prayer_id)`; sets `answered_at, testimony, testimony_post_id`; notifies everyone who prayed (`prayer_answered`); returns post id (idempotent) | `POST /api/prayers/:id/answer` |
| `queue_prayer_summaries()` (pg_cron 20:00 UTC) | One `prayer_summary` notification per author: "N people prayed for you today" (last 24 h, excluding self) | Worker job in `src/worker/jobs.ts` via NotificationsService |
| `friends_going(event_ids[])` | Per event: count + `[{id, full_name, avatar_url, avatar_color}]` of mutual-follow friends with a confirmed RSVP or ticket | `POST /api/friends/going` |
| `friends_this_week()` | Published events in the next 7 days that friends are going to (max 10) with friend list | `GET /api/friends/this-week` |
| `my_friends()` | Mutual follows `{id, full_name, avatar_url, avatar_color}` ordered by name | `GET /api/friends` |
| `notify_friends_of_rsvp()` (trigger after insert on rsvps) | On a confirmed RSVP to an upcoming published event, notify mutual friends in the same city (`friend_rsvp`), max one per friend per day | RSVP service via NotificationsService |
| `serve_signup_guard()` (trigger) | Volunteers may only cancel / re-join; locks the shift row, rejects started or full shifts (`signed_up, checked_in, completed` count vs `spots`) | `POST /api/serve/shifts/:id/signup`, cancel (use a transaction with `SELECT ... FOR UPDATE`) |
| `serve_check_in(code)` | Organizer/admin only; validates code; `{valid:false, error}` for unknown/cancelled/already; sets `checked_in` + time; `{valid:true, message:"<name> checked in · <role>"}` | `POST /api/serve/check-in` |
| `complete_serve_shift(shift_id)` | Organizer/admin; sets shift `completed_at`; checked_in → completed; signed_up → no_show; returns completed count | `POST /api/serve/shifts/:id/complete` |
| `message_volunteers(shift_id, message)` | Organizer/admin; message ≥ 2 chars; `serve_message` notification to signed_up/checked_in volunteers (body ≤ 500); returns count | `POST /api/serve/shifts/:id/message` |
| `my_hours_served()` | Sum of completed shift hours, 1 decimal | `GET /api/serve/hours` |
| `open_serve_shifts(church_id, event_id)` | Upcoming shifts (published or no event) with role/event/church names, taken count and the caller's signup (id, status, code); limit 100 | `GET /api/serve/shifts` |
| `resolve_report(report_id, action)` | Admin; `remove` hides prayer/church, deletes post/reply/forum message, cancels event; marks all open reports on that target actioned/dismissed | `POST /api/admin/reports/:id/resolve` |
| `admin_report_queue()` | Admin; open reports with per-target count, 240-char preview of the target and reporter name | `GET /api/admin/reports` |
| `set_post_type(post_id, type)` | Author only; type in prayer/praise/testimony/encouragement | `PATCH /api/community-posts/:id/type` |
| `delete_my_account()` | Blocks if the user hosts upcoming published events with confirmed tickets. If they host events with sales history: cancel future events, scrub the profile ("Deleted host"), delete their posts/replies/forum posts/prayers/follows/push tokens/settings/verification, rename the user's email to `deleted+<id>@deleted.christlinksocial.com`. Otherwise delete forum posts then the user (cascades; tickets keep a null `user_id`) | `DELETE /api/account`. Note: the SQL set `profiles.email = null` but the column is NOT NULL, so use the same `deleted+<id>@...` address there too. Also revoke the user's `refresh_tokens` |
| `decrement_tickets_sold(type_id, qty)` | Broken in prod (updates a non-existent `ticket_types.tickets_sold`) | Use `sold = greatest(0, sold - qty)` in TS |
| `increment_coupon_uses(coupon_id)` | Broken in prod (non-existent `coupons.times_used`) | Use `coupons.uses + 1` in TS |
| `increment_reply_count(post_id, delta)` | Broken in prod (non-existent `event_forum_posts.reply_count`) | Drop the call |

Kept in the database (no `auth.*` dependency; call with `prisma.$queryRaw`/`$executeRaw`):
`adjust_post_amen_count`, `adjust_reply_amen_count`, `approve_rsvp` (returns `not_pending` / `full` / `confirmed`),
`clean_old_rate_limits` (run by the worker's `rate-limit-cleanup` job), `increment_event_views`,
`increment_promoter_clicks`, `increment_tickets_sold`, `upsert_post_reaction` (returns `action, emoji, total_count`),
`are_friends(a, b)`, `verse_of_the_day(theme)`, `serve_shift_counts(shift_ids[])`, and the trigger functions
`update_updated_at` / `touch_updated_at`. `SECURITY DEFINER` was removed from all of them.

## Dropped triggers
`events_guard_privileged`, `profiles_guard_privileged`, `churches_guard`, `prayers_guard`, `rsvps_notify_friends`,
`serve_signups_guard` (see the functions above). Kept: `update_events_updated_at`, `update_host_accounts_updated_at`,
`update_profiles_updated_at`, `churches_touch`, `user_settings_touch`, plus new `users_touch`.

## Dropped views (rewrite as queries in the admin / events services)

| View | Columns |
|---|---|
| `admin_overview` | total_users, published_events, total_events, total_revenue_cents, total_tickets_sold, total_rsvps (confirmed only) |
| `admin_daily_revenue` | day, tickets_sold, revenue_cents, platform_fee_cents (confirmed tickets, newest first) |
| `admin_daily_signups` | day, signups (profiles per day) |
| `admin_revenue_summary` | month, tickets_sold, gross_cents, stripe_fee_cents, platform_fee_cents |
| `admin_event_stats` | event id, name, status, start_date, city, state, is_paid, listing_fee_paid, host_name, host_email, confirmed_rsvps, tickets_sold, gross_revenue_cents |
| `admin_events_by_type` | event_type, total, published |
| `admin_top_events` | id, name, city, state, start_date, tickets_sold, revenue_cents (top 50) |
| `admin_top_hosts` | id, full_name, email, events_created, tickets_sold, host_revenue_cents (top 50) |
| `admin_user_stats` | id, full_name, email, created_at, events_hosted, rsvps_made, tickets_purchased |
| `events_with_details` | every events column + host_name, host_avatar, host_avatar_color, ticket_types (json array ordered by sort_order, price_cents), confirmed_rsvps (int) |
| `post_reaction_summary` | post_id, emoji, count |

## Other things not carried over
- RLS policies, GRANT/REVOKE, OWNER, `supabase_realtime` publication (community_posts realtime), vault,
  pg_stat_statements, `pg_cron` schedule.
- `default auth.uid()` column defaults (churches.created_by, church_claims/church_follows/user_settings/push_tokens/
  prayers/prayer_prays/blocks/serve_roles/serve_signups/reports owner columns): set them explicitly on insert.
- `ticket_checkins.checked_in_by` is NOT NULL with `ON DELETE SET NULL` (same as production after the native
  migration); deleting a user who checked tickets in will fail until that is resolved. Prisma warns about it.
