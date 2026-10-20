# Christ Link backend (Railway) — architecture and API contract

Decided Oct 2026 (docs/LAUNCH.pdf): Christ Link moves off server.js + Supabase to its own NestJS API on Railway
(Postgres + Redis + a worker service) with files on Cloudflare R2, the same setup as Vendly. Nothing depends on
Supabase after the switch. The live website keeps running on server.js + Supabase until the planned switch.

## Services (Railway project "ChristLink")

| Service | Start command | Purpose |
|---|---|---|
| `ChristLink-API` | `node dist/src/main` | HTTP API (`backend/`) |
| `ChristLink-Worker` | `node dist/src/worker` | BullMQ jobs: push, email, scheduled jobs |
| `Postgres` | Railway template | All data |
| `Redis` | Railway template | OTP codes, rate limits, BullMQ queues |

Environments: `production` (untouched until the switch) and `staging` (what the native app tests against).

## Rules
1. **Same API shape as server.js.** Every route in `__tests__/lib/api-contract.test.ts` keeps its path, method,
   request body and response fields from server.js (reference copy: NolimitDae/ChristLink1 `server.js`). The website
   must be able to switch by changing only its login and upload code.
2. **Same table and column names** as the production Supabase `public` schema plus the native-feature tables from
   `supabase/migrations/20261015000000_native_features.sql`, so production data copies across with a plain load.
   `auth.users` becomes `public.users` (same ids).
3. Money is integer cents. Fee math must equal `lib/fees.ts` / server.js `calcFees`.
4. Errors are `{ "error": "Human readable message" }` with a 4xx/5xx status, like server.js.
5. Routes live under `/api`, except `GET /health` and `POST /webhook` (Stripe), which stay at the root like server.js.

## Auth (email one-time code; replaces Supabase Auth)
| Route | Body | Response |
|---|---|---|
| `POST /api/auth/signin` | `{ email }` | `{ success: true, message }` — sends a 6-digit code via Resend |
| `POST /api/auth/signup` | `{ email, fullName? }` | same as signin; stores fullName for the new profile |
| `POST /api/auth/verify-otp` | `{ email, token }` | `{ success, accessToken, refreshToken, expiresIn, user: { id, email, profile } }` |
| `POST /api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken, expiresIn }` (rotates; old token revoked) |
| `POST /api/auth/signout` | `{ refreshToken }` | `{ success: true }` (revokes it) |

- Code: 6 digits, stored hashed in Redis for 10 min, max 5 attempts, 1 send per 60 s per email.
- Access token: HS256 JWT (`JWT_SECRET`), 1 hour, `sub` = user id. Refresh token: random, stored hashed in
  `refresh_tokens`, 60 days, rotated on every refresh.
- First verify creates `users` + `profiles` rows (what Supabase's `handle_new_user` trigger did).
- `REVIEW_EMAIL` + `REVIEW_CODE` env: a fixed code for the App Store / Play reviewer account.
- No `RESEND_API_KEY` (local dev only): the code is written to the log instead of emailed.

## Files (Cloudflare R2; replaces Supabase Storage)
Upload routes keep server.js's shape (`{ dataUrl }` → `{ url }`, max 5 MB): `/api/upload-avatar`, `/api/upload-banner`,
`/api/upload-event-image`, `/api/upload-forum-image`. Public files go to `R2_BUCKET` under `avatars/`, `banners/`,
`events/`, `forum/` and are served from `R2_PUBLIC_URL`. ID documents go under `private/id-docs/` and are only
readable through a 5-minute signed URL from `GET /api/admin/verifications/:userId/id-doc`.
shortcut: uploads pass through the API as data URLs (5 MB cap) to keep the web-compatible shape; move to presigned
direct uploads if video or larger files are added.

## Push and jobs (replaces the push-dispatch Edge Function and pg_cron)
`NotificationsService.create(userId, type, title, body, data)` inserts a `notifications` row and queues a push job.
The worker sends it through the Expo push API to every `push_tokens` row of that user, honoring
`user_settings` per-type toggles and quiet hours, and deletes tokens Expo reports as `DeviceNotRegistered`.
Repeatable jobs: daily prayer summary (20:00 UTC), scheduled publish (`events.publish_at`), rate-limit cleanup.

## Native-feature routes (replace lib/features.ts Supabase calls; all need auth unless marked public)
Response shapes equal what the Supabase RPC / table query returned (see the SQL migration for exact columns).

| lib/features.ts | Route |
|---|---|
| getVerseOfTheDay | `GET /api/verses/today?theme=` (public) → `{ reference, text, translation } \| null` |
| listVerses / saveVerse | `GET /api/admin/verses`, `POST /api/admin/verses`, `PATCH /api/admin/verses/:id` (admin) |
| getSettings / updateSettings | `GET /api/settings` → `UserSettings \| null`; `PATCH /api/settings` → `UserSettings` |
| savePushToken | `POST /api/push-tokens { token, platform }` (re-assigns the token to the caller) |
| (sign-out) | `DELETE /api/push-tokens/:token` |
| deleteMyAccount | `DELETE /api/account` (same effect as SQL `delete_my_account()`: keeps ticket/payment rows) |
| getFriendsGoing | `POST /api/friends/going { event_ids }` → `FriendsGoing[]` |
| getFriendsThisWeek / getMyFriends | `GET /api/friends/this-week`, `GET /api/friends` |
| getPrayerWall | `GET /api/prayers?filter=&before=&limit=30` → `Prayer[]` |
| createPrayer / deletePrayer | `POST /api/prayers { body, is_anonymous, church_id }`, `DELETE /api/prayers/:id` |
| prayFor | `POST /api/prayers/:id/pray` → `{ count }` |
| markPrayerAnswered | `POST /api/prayers/:id/answer { testimony }` → `{ post_id }` |
| setPostType | `PATCH /api/community-posts/:id/type { type }` |
| reportContent | `POST /api/reports { target_type, target_id, reason, details }` (duplicate = 200) |
| blockUser / unblockUser / getBlockedIds | `POST /api/blocks { user_id }`, `DELETE /api/blocks/:userId`, `GET /api/blocks` → `string[]` |
| getReportQueue / resolveReport | `GET /api/admin/reports`, `POST /api/admin/reports/:id/resolve { action }` (admin) |
| searchChurches / getChurch | `GET /api/churches?q=&limit=` (public), `GET /api/churches/:id` (public) |
| createChurch / updateChurch | `POST /api/churches`, `PATCH /api/churches/:id` (owner or admin) |
| claimChurch | `POST /api/churches/:id/claim { role_at_church, note }` |
| listPendingClaims / decideChurchClaim | `GET /api/admin/church-claims`, `POST /api/admin/church-claims/:id/decide { approve }` |
| getChurchRecurring / saveRecurring / deleteRecurring | `GET /api/churches/:id/recurring` (public), `POST /api/churches/:id/recurring`, `PATCH /api/church-recurring/:id`, `DELETE /api/church-recurring/:id` |
| getChurchEventIds / linkEventToChurch | `GET /api/churches/:id/events` → `string[]` (public), `POST /api/churches/:id/events { event_id }` |
| isFollowingChurch / setFollowChurch | `GET /api/churches/:id/follow` → `{ following }`, `POST` / `DELETE /api/churches/:id/follow` |
| getMyManagedChurches | `GET /api/my-churches` |
| getOpenShifts | `GET /api/serve/shifts?church_id=&event_id=` (public) |
| signUpForShift / cancelSignup | `POST /api/serve/shifts/:id/signup` → `{ id, code }`, `POST /api/serve/signups/:id/cancel` |
| createServeRole | `POST /api/serve/roles` → `{ id }` |
| getMyManagedShifts / getShiftRoster | `GET /api/serve/my-shifts`, `GET /api/serve/shifts/:id/roster` |
| serveCheckIn | `POST /api/serve/check-in { code }` → `{ valid, message?, error? }` |
| completeShift / messageVolunteers | `POST /api/serve/shifts/:id/complete` → `{ count }`, `POST /api/serve/shifts/:id/message { message }` → `{ count }` |
| getHoursServed | `GET /api/serve/hours` → `{ hours }` |

## Environment variables (set in Railway; never in the repo)
`DATABASE_URL`, `REDIS_URL` (Railway references), `JWT_SECRET`, `CLIENT_APP_URL`, `CORS_ORIGINS`, `APP_URL`,
`RESEND_API_KEY`, `FROM_EMAIL`, `REVIEW_EMAIL`, `REVIEW_CODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_URL`, `EXPO_ACCESS_TOKEN` (optional), `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_PASS_P12_BASE64`,
`APPLE_PASS_PASSWORD` (Wallet), `SENTRY_DSN` (optional).

## Data copy (production Supabase → Railway)
`backend/scripts/import-supabase.ts` loads a `supabase db dump --data-only` file: `auth.users` (id, email,
created_at only) → `users`; every `public` table → the same table. Files: `backend/scripts/copy-storage.ts` copies
the Supabase `avatars`, `banner-images` and `event-images` buckets to R2 and rewrites stored URLs.
