# Moving christlinksocial.com to the new app (switch-over runbook)

The website becomes this repo's app (the same screens as the phone app, built for the browser) on the new backend.
The old site (`NolimitDae/ChristLink1`: server.js + Supabase) stops serving the domain. Everyone keeps their account.

> Domain: **christlinksocial.com** (and www.christlinksocial.com, which redirects to it). The app's shared links,
> universal links and the sign-in email sender already use it. DNS is on **Cloudflare** (proxied); `www` has no record.

## Status: switched on 2026-11-07

**christlinksocial.com now serves the new app** (Railway project ChristLink → **ChristLink-Web**), on the new API and
database. The old ChristLink1 service still runs at christlink1-production.up.railway.app, without the domain (rollback:
remove the domain from ChristLink-Web and add it back to ChristLink1).

What was done:
- `master` has everything (PRs #2 and #3). Production services follow `master`:
  - **ChristLink-API**: migrations applied; generated `JWT_SECRET`; Stripe, Apple Wallet and the Supabase URL/anon key
    are *references* to the ChristLink1 service (`${{ChristLink1.…}}`); `RESEND_API_KEY` (sign-in emails verified
    working); R2 keys (access key/secret referenced from the worker); `EMAIL_LOGO_URL` set.
  - **ChristLink-Worker** (`ROLE=worker`): Resend and R2 keys (`R2_ACCOUNT_ID` referenced from the API).
  - **ChristLink-Web** (`Dockerfile.web`; settings set on the service directly because new Railway services can't use
    a config file path): custom domains `christlinksocial.com` and `www.christlinksocial.com`.
- Final data copy at the switch (07:24 UTC): 75 accounts, 75 profiles, 12 events, 11 tickets, 69 RSVPs, 64 follows,
  25 event chat posts, 19 notifications, 31 verses, 5 posts, 3 coupons, 1 host Stripe account. Identical to the old
  site. **Data-Copy-Temp** is disarmed (`DRY_RUN=1`, `WIPE=0`): a redeploy only reports counts. Delete it once you're
  happy (it holds a reference to the Supabase service-role key).
- Smoke tested on the live domain: home and an old `#event/<id>` link open the right page with live data, CORS, the
  Apple app-link file, Stripe's `/webhook` path reaching the API, and an emailed sign-in code.

Still to do:
1. **`www`**: Cloudflare → DNS → add `CNAME www → 352f9l9o.up.railway.app` (proxied, like the apex) and
   `TXT _railway-verify.www → railway-verify=ca0db222f0ed67ca73cc8deb0ac774cf9db186cf819a3a1422dcf1e3cfec27b6`.
   Until then www.christlinksocial.com doesn't answer.
2. **Photo uploads**: Cloudflare → R2 → `christlink-media` → Settings → Public access → Custom domain
   `media.christlinksocial.com`, then set `R2_PUBLIC_URL=https://media.christlinksocial.com` on ChristLink-API and
   ChristLink-Worker. Until then uploads answer "unavailable" (existing photos load from Supabase Storage). After that,
   run `backend/scripts/copy-storage.mjs` so old photos move to R2 before Supabase is paused.
3. Optional: `ANDROID_SHA256_FINGERPRINTS` on ChristLink-Web (Android app links); Stripe → Payment method domains →
   christlinksocial.com (Apple Pay / Google Pay on the website).
4. Keep the Supabase project and the ChristLink1 service ~60 days (session hand-over + rollback), then remove
   `LEGACY_SUPABASE_*` from the API, pause Supabase and delete ChristLink1.

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
