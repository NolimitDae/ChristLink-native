# Moving christlinksocial.com to the new app (switch-over runbook)

The website becomes this repo's app (the same screens as the phone app, built for the browser) on the new backend.
The old site (`NolimitDae/ChristLink1`: server.js + Supabase) stops serving the domain. Everyone keeps their account.

> Domain: **christlinksocial.com** (and www.christlinksocial.com, which redirects to it). The app's shared links,
> universal links and the sign-in email sender already use it. DNS is on **Cloudflare** (proxied); `www` has no record.

## Status (2026-11-06)

Done, without touching the live site (christlinksocial.com is still the old ChristLink1 service):
- `master` has everything (PR #2). Railway project **ChristLink** (production):
  - **ChristLink-API** follows `master`; migrations applied; settings: generated `JWT_SECRET`, Stripe and Apple
    Wallet values and the Supabase URL/anon key are *references* to the ChristLink1 service (`${{ChristLink1.…}}`),
    so they stay identical to the old site's and never had to be copied.
  - **ChristLink-Worker** (new, follows `master`, `ROLE=worker`).
  - **ChristLink-Web** (new, follows `master`, `Dockerfile.web`, settings set on the service directly because new
    Railway services can't use a config file path): https://christlink-web-production.up.railway.app — loads live
    production data, live Stripe publishable key, Apple app-link file served.
  - **Data-Copy-Temp** (`backend/scripts/supabase-migrate`): copied the old site into production (75 accounts,
    75 profiles, 12 events, 11 tickets, 69 RSVPs, 64 follows, 25 event chat posts…). Redeploy it to copy again; it
    wipes and reloads in one transaction. Delete the service after the switch.
- Staging (`claude/railway-launch`) runs the same code.

Still needed before the switch:
1. **Resend** (sign-in codes): put the key on ChristLink → ChristLink-API and ChristLink-Worker as `RESEND_API_KEY`
   (the key in the Vendly project works if christlinksocial.com is verified in that Resend account: Resend →
   Domains → add christlinksocial.com → add its DNS records in Cloudflare). Without it nobody can sign in.
2. **R2** (photo uploads): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` on
   the API and Worker in both projects. Existing photos keep loading from Supabase Storage until `copy-storage.mjs` runs.
3. Optional: `ANDROID_SHA256_FINGERPRINTS` on ChristLink-Web (Android app links), Stripe → Payment method domains →
   christlinksocial.com (Apple Pay / Google Pay on the web).

The switch itself (≈15 minutes):
1. Railway → ChristLink1 → Settings → Networking: remove `christlinksocial.com` (site offline from here).
2. Railway → Data-Copy-Temp → Redeploy (final copy; check its log says `Done.` with the counts).
3. Railway → ChristLink-Web → Networking → add `christlinksocial.com` and `www.christlinksocial.com`.
4. Cloudflare → DNS: point `christlinksocial.com` (and add `www`) to the CNAME target Railway shows in step 3, and
   add Railway's `_railway-verify` TXT records if it asks. Keep the records proxied (orange cloud) as now.
5. Set `EMAIL_LOGO_URL=https://christlinksocial.com/brand/logo-email.png` on the API. Smoke test (below).

## Why nobody has to make a new account

1. **There are no passwords to move.** The old site signs people in with a 6-digit email code (Supabase
   `signInWithOtp`); the new backend does the same (`/api/auth/*`). A person's email *is* their login.
2. **The data copy keeps every id.** `backend/scripts/import-supabase.mjs` copies Supabase `auth.users` (id, email,
   created_at, last sign-in) into `users` with the **same ids**, and every `public` table (profiles, events, tickets,
   RSVPs, follows, posts, prayers, churches, host Stripe accounts…) into the table of the same name. Profile photos,
   banners and event images move from Supabase Storage to R2 with `backend/scripts/copy-storage.mjs`, which rewrites
   the stored URLs.
3. **Sign-in finds the same account.** Entering their email sends a code; verifying it opens the account with that
   email (matched lower-case; the import stores emails lower-case for this).
4. **People already signed in on the website stay signed in.** The new web app runs on the same domain, so it can
   read the old site's saved session once. It sends it to `POST /api/auth/legacy-exchange`; the API asks the old
   Supabase project to confirm it and opens the matching account (same id, or same email). It never creates accounts.
   If anything doesn't match, the visitor just signs in with an email code as before.
5. **Payments and payouts continue.** Tickets and orders are rows in the copied tables; hosts' Stripe Connect accounts
   (`host_stripe_accounts`) are copied, and the new backend uses the same Stripe account and keys.

Guards in the import (it stops and changes nothing): two accounts whose emails only differ by capital letters, or an
imported profile whose email already belongs to a *different* account in the target database (for example someone
who signed up on the new app before the import). Fix those and run it again.

What does not carry over: being signed in on *other* browsers or devices where the old session has expired (they sign
in with an email code once), and browser-only settings of the old site. The phone app is new: people sign in once
with their email and see their existing account.

## Before the switch (no visitor impact)

1. **Backend production** (Railway project "ChristLink"): API, worker, Postgres and Redis running from `master`
   (docs/BACKEND.md). Production variables, in addition to those in BACKEND.md:
   - `CLIENT_APP_URL=https://christlinksocial.com`, `CORS_ORIGINS=https://christlinksocial.com,https://www.christlinksocial.com`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`: the **same** live values the old
     site uses (Railway → old ChristLink1 service → Variables), so webhook signatures keep validating.
   - `LEGACY_SUPABASE_URL=https://iqosvigdelnmarecpkkp.supabase.co` and `LEGACY_SUPABASE_ANON_KEY` = the old site's
     anon key (Supabase → Project Settings → API; it is public, the old site already ships it).
   - `EMAIL_LOGO_URL=https://christlinksocial.com/brand/logo-email.png` (set it after the switch; until then the
     sign-in email shows a text header).
   - Resend: `FROM_EMAIL` on a domain verified in Resend (DNS records), or codes won't arrive.
2. **Website service**: Railway → project "ChristLink" → New → GitHub repo `NolimitDae/ChristLink-native`, branch
   `master`. Settings: root directory `/`, Config-as-code path `web/railway.toml` (builds `Dockerfile.web`). Variables:
   - `EXPO_PUBLIC_API_BASE` = the production API URL (the same value as the production app builds, docs/BUILDS.md)
   - `EXPO_PUBLIC_STRIPE_PK` = the live publishable key; `EXPO_PUBLIC_SENTRY_DSN` (optional)
   - `API_ORIGIN` = the production API URL (forwards Stripe's `POST /webhook`, so the webhook URL never changes)
   - `CANONICAL_HOST=christlinksocial.com` (www. and other hosts redirect there)
   - `APPLE_TEAM_ID` (Apple Developer → Membership) and `ANDROID_SHA256_FINGERPRINTS` (Play Console → App integrity →
     App signing, SHA-256): the server builds `/.well-known/apple-app-site-association` and `assetlinks.json` from
     them, so event and church links open the phone app.
   Generate a Railway domain for it and open it: it should load and show production data.
3. **Rehearse on staging** (do this at least once): dump production, import into staging with `--wipe`, copy the
   storage buckets to the staging R2 bucket, then sign in to the staging web/app with *your* email and check your
   profile, hosted events, tickets, followers and photos.
   ```sh
   npx supabase@latest db dump --db-url "<Supabase connection string>" --data-only --use-copy -s public,auth -f prod_data.sql
   cd backend && DATABASE_URL="<staging Postgres public URL>" node scripts/import-supabase.mjs ../prod_data.sql --wipe
   ```
4. **Stripe**: Dashboard → Settings → Payment method domains → add `christlinksocial.com` (Apple Pay / Google Pay on
   the website). The webhook endpoint can stay `https://christlinksocial.com/webhook`.

## The switch (about 30 minutes; pick a quiet hour and announce it)

1. Railway → old ChristLink1 service → Settings → Networking → remove the `christlinksocial.com` / `www` domains.
   The site is offline from here, so nothing new is written to Supabase. (Stripe retries webhooks for 3 days.)
2. Final dump of production Supabase (command above).
3. Import into the **production** Postgres (empty database: no `--wipe` needed; the guards above apply):
   `cd backend && DATABASE_URL="<production Postgres public URL>" node scripts/import-supabase.mjs ../prod_data.sql`
4. Copy files: `node scripts/copy-storage.mjs` with the production R2 variables (see the script header).
5. Railway → ChristLink-Web → Settings → Networking → add `christlinksocial.com` and `www.christlinksocial.com`
   (Railway shows the DNS records; they are the same ones the old service used, so DNS usually needs no change).
6. Smoke test (desktop and phone browser):
   - The site loads; an old link like `https://christlinksocial.com/#event/<id>` opens that event.
   - A browser that was signed in on the old site opens signed in (this is the session hand-over).
   - Sign out, sign in with an email code: same profile, photo, events, tickets.
   - Buy a ticket with a real card and refund it; the ticket appears in Tickets and the webhook shows 200 in Stripe.
   - `curl -I https://christlinksocial.com/.well-known/apple-app-site-association` → 200, `application/json`.
7. Set `EMAIL_LOGO_URL` on the API (step 1 of "Before the switch").

## After the switch

- Keep the old **Supabase project running** (no changes needed) for about 60 days: the session hand-over uses it,
  and it is your backup. Then remove `LEGACY_SUPABASE_*` from the API and pause the project.
- Keep the old ChristLink1 Railway service (stopped, not deleted) for the same period.
- **Rollback**: give the domain back to the old service in Railway. Anything created on the new system after the
  switch would not be on the old one, so roll back only in the first hours.
- Update the App Store / Play listing URLs if they pointed at old pages (privacy: `/legal/privacy`, terms:
  `/legal/terms`).

## What the website can and can't do

Same features as the phone app, with these browser differences: no Map tab (the map needs the app), no push
notifications or local reminders, the host check-in scanner depends on the browser's camera support, and share
cards share text and a link instead of an image. Payments use Stripe's Payment Element (cards, plus Apple Pay /
Google Pay where the browser and the domain registration allow); hosts' listing-fee card uses Stripe's card field.
Sessions are kept in the browser's localStorage, as the old site did (docs/SECURITY.md).
