# Progress log

## 2026-10-28 — Supabase migration applied; owner switching to the Railway backend

**Changed**
- Applied `20261015000000_native_features.sql` to the live Supabase project (ChristLink). It was sent in four
  hash-checked pieces and run in one transaction only after the full text matched the file. Verified: 15 tables
  with RLS, 28 functions, 6 triggers, 31 verses, tickets FK now `on delete set null`. Scratch schema removed.

**Direction change (owner, mid-session):** Supabase is no longer used; the app moves to the Railway backend.
- This branch is built on Supabase (auth, churches, prayers, serve, settings). Its `backend/` is only a stub.
- `claude/railway-launch` already has the full NestJS + Prisma backend (auth with email codes via Resend, events,
  tickets, payments, community, prayers, churches, serve, reports, settings, admin), an app with Supabase removed
  (Expo SDK 58), and `backend/scripts/import-supabase.mjs` to copy the live data.
- Railway: staging API is live with an empty database; production `ChristLink-API` only answers `/api/health`.
- The Supabase migration applied today is additive. One live effect: website RSVPs now create "friend is going"
  notifications for mutual followers. It can be reverted if wanted.

**Needs the owner**
- Confirm moving to `claude/railway-launch` as the app, then: deploy the production API, import the Supabase data,
  set `RESEND_API_KEY` on Railway, point the EAS API variable at the Railway API, build and test.

## 2026-10-27 — Password sign-in, API host fixed, new Android build

**Decided (owner):** this branch is the app; `claude/railway-launch` is not.

**Changed**
- EAS: `EXPO_PUBLIC_API_BASE` is now the ChristLink1 API in development, preview and production (was staging).
- Sign-in screen: Sign in / Create account with email + password (same accounts as the website; works with no
  email setup), forgot password, show/hide password, plain error messages (`lib/authMessages.ts`, 14 new tests).
  The email code stays as "Email me a sign-in code instead".
- README, CLAUDE.md and STORE.md (App Review demo account) describe password sign-in.
- Android preview build 3f910532 finished: ChristLink1 API, live Supabase, update channel `preview`.
- Checked the native-features migration against the live schema: no name clashes, all referenced columns and
  constraint names exist. Not applied (see below).

**Not finished / needs you**
- Apply `supabase/migrations/20261015000000_native_features.sql`: Supabase → ChristLink → SQL Editor → paste the
  whole file → Run. It is one transaction. Not applied from the session because the tool needs the 54 KB file
  retyped by hand, which risks a silent copy error in the live database.
- Supabase Auth settings for email codes and password reset: Magic Link template with `{{ .Token }}`,
  custom SMTP, Site URL `https://christlinksocial.com` + redirect `christlink://`.
- `EXPO_PUBLIC_STRIPE_PK` (pk_test) in the development EAS environment, then a rebuild or update.
- iPhone: Apple Developer account, `eas device:create`, first `eas build --profile preview --platform ios`.

**Test**
- Install the new APK. Sign in with an existing website account. Create a new account. Wrong password shows
  "Wrong email or password". Browse events, RSVP to a free event, open the ticket QR.

## 2026-10-24 (evening) — "Logins are not working": investigation only, no code changed

**Found**
- No sign-in request from any app reached any backend in the last 48 hours: Supabase auth (ChristLink project),
  ChristLink1 on Railway, ChristLink-API production, or the staging API. A test request from the session showed up in
  the Supabase logs within seconds, so the logs are reliable.
- Supabase has never issued an email sign-in code on the ChristLink project (only 4 password-reset tokens, August).
  All 74 existing users sign in with a password on the web; the last sign-in was 2026-09-20.
- The endpoint itself works: the app's key is valid, email sign-in and sign-up are on.
- The auth Site URL is still `https://christlink.netlify.app`.

**Will break code sign-in once requests arrive (Supabase dashboard, not code)**
1. Auth → Email Templates → Magic Link must contain `{{ .Token }}`. By default it only sends a link, and the app
   asks for a 6-digit code.
2. Auth → SMTP: without a custom SMTP server, Supabase only emails members of the Supabase team, a few per hour.
3. Auth → URL Configuration: Site URL should be `https://christlinksocial.com`, plus `christlink://` as a redirect URL.

**Need from you**
- Which app and phone you tested (Android APK from the expo.dev link, or something on iPhone) and the exact message.
  There is no iPhone build of this branch yet, and current Expo Go cannot open an SDK 51 project.

## 2026-10-24 (later) — EAS Update + Vendly-style build setup

**Changed**
- Added `expo-updates` and `expo-dev-client`; `app.json` has `runtimeVersion: { policy: appVersion }` and the
  `u.expo.dev` update URL. Prebuild writes both into the iOS and Android projects.
- `eas.json` copies the Vendly layout: Node 20.18.0, Android image `latest`, iOS image `sdk-51`, `appVersionSource:
  local`, preview reads the **development** EAS environment, channels development / preview / production.
  Kept for this app: Sentry upload off, preview Android as an installable APK, production as an AAB.
- The API host moved out of `eas.json`; it must now come from EAS environment variables.
- New docs/BUILDS.md (profiles, env variables, commands). CLAUDE.md Deploys section points to it.
- typecheck, lint, 154 tests, expo-doctor 17/17, iOS + Android bundle and prebuild all pass.

**Not finished / needs you**
- Set `EXPO_PUBLIC_API_BASE` in the development and production EAS environments (commands in docs/BUILDS.md and
  the session summary). The current value is one variable shared by preview and development that points at the
  staging NestJS API used by `claude/railway-launch`. Until it is split, a preview build from this branch would
  talk to the wrong API. I was not allowed to change the shared value from the cloud session.
- No build has been run with the new eas.json yet. Run the Android preview build first.
- Both branches use the same EAS project, channel names and app version 1.0.0. Once both have builds, an update
  published from one branch could reach the other's builds and crash them. Give one branch a different `version` or
  channel before that happens.

## 2026-10-24 — Fix EAS build blockers; first Android preview build succeeds

**Changed**
- `eas.json`: production Android `buildType` `aab` → `app-bundle` (EAS refused the whole file before).
  Profiles share a `base`: `EXPO_PUBLIC_API_BASE` pinned to the ChristLink1 API and `SENTRY_DISABLE_AUTO_UPLOAD=true`.
  Each profile names its EAS environment. `cli.appVersionSource: remote` so `autoIncrement` persists.
- `app.json`: linked the existing EAS project `@nolimittechs-organization/christlink` and set `owner`.
- `app.config.js`: an EAS build now fails early if the Supabase URL, anon key or API host is missing.
- `.npmrc` with `legacy-peer-deps=true`: EAS runs plain `npm install`, which failed on the eslint peer range.
- Installed `expo-system-ui` so Android follows the light/dark setting.
- EAS environment variables (development, preview, production): `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the **ChristLink** Supabase project (the live one; ChristLink Dev is empty).
  The existing `EXPO_PUBLIC_API_BASE` staging values were left alone; this branch overrides them in `eas.json`.
- Android preview build finished (build a7fca629 on expo.dev). The APK contains the live Supabase URL and the
  ChristLink1 API host.

**Watch out**
- Branch `claude/railway-launch` is a separate rewrite (SDK 58, no Supabase, staging NestJS API) that uses the same
  EAS project and the same shared environment variables. Decide which branch is the future before merging;
  their `eas.json` files will conflict.

**Not finished / needs you**
- `EXPO_PUBLIC_STRIPE_PK` (a `pk_test_` key) is not set, so paid checkout is off in builds. Free RSVPs still work.
- Supabase migration `20261015000000_native_features.sql` is not applied to any project yet.
- iOS: no build yet. The first one must be run interactively to sign in to Apple and create certificates.
- Google Maps Android key, Sentry org/project/auth token, `eas submit` Apple ids, `EXPO_TOKEN` GitHub secret.

**Test**
- Install the preview APK on an Android phone and run the 2026-10-15 checklist below (skip paid checkout).

## 2026-10-23 — EAS build readiness check (no app code changed)

**Changed**
- Nothing in the app. Ran the full build-readiness check and logged the result here.

**What passed**
- `npm ci`, typecheck, lint, 154/154 unit tests, `expo-doctor` (17/17), `expo install --check` (all SDK 51 versions).
- `expo export` bundles iOS + Android; `expo prebuild` generates both native projects with every config plugin.
- Icons are the right sizes; the iOS App Store icon comes out of prebuild without transparency.

**Blockers before `eas build` works**
1. `eas.json` production profile: `"buildType": "aab"` is rejected by EAS CLI (`eas build` refuses to start for
   any profile). Must be `"app-bundle"`.
2. `app.json` `extra.eas.projectId` is still `REPLACE_WITH_EAS_PROJECT_ID`. Run `eas init` and paste the real id
   (the config is dynamic via `app.config.js`, so EAS may ask you to add it by hand).
3. Env vars: `.env.local` is git-ignored, so EAS cloud builds never see it, and the preview/production profiles
   set no `EXPO_PUBLIC_*` values. Without `EXPO_PUBLIC_SUPABASE_URL` the app crashes on launch
   (`createClient` throws "supabaseUrl is required"). Add them as EAS environment variables
   (`eas env:create`) for preview and production. GitHub secrets in the CI job are not forwarded to the build worker.
4. Sentry source-map upload runs in the native build and fails without `SENTRY_ORG`, `SENTRY_PROJECT` and
   `SENTRY_AUTH_TOKEN`. On iOS a failed upload also skips the JS bundle step. Either set those three as EAS secrets
   or set `SENTRY_DISABLE_AUTO_UPLOAD=true` in each build profile's `env`.

**Not blocking, but fix soon**
- First iOS build must be run interactively (`eas build -p ios`) so EAS can create certificates, the Apple Pay
  merchant id `merchant.com.christlinksocial.app` and the Associated Domains capability. The CI job uses
  `--non-interactive` and also needs an `EXPO_TOKEN` secret.
- `GOOGLE_MAPS_API_KEY` is empty, so Android maps render blank.
- `eas.json` has no `cli.appVersionSource` (EAS warns; set `"remote"` to pair with `autoIncrement`).
- `eas.json` submit block still has `REPLACE_WITH_*` Apple ids (only needed for `eas submit`).
- Android `userInterfaceStyle: automatic` needs `expo-system-ui` installed to take effect.

**Test**
- After the four blockers: `eas build --profile preview --platform android` first (no Apple credentials needed),
  install the APK, and confirm sign-in and the events feed load.

## 2026-10-15 — Build plan Phases 0–5 for the native app

**Changed**
- Read the build plan and adapted it to this repo: a real Expo app instead of the Median web wrapper (avoids App
  Store Guideline 4.2), built against the live Railway API. The real route list came from the public web app.
- Fixed bugs that shipped in the previous native code:
  - Posts rendered blank (the API returns `body`/`author_id`).
  - Host photos and going counts were missing (`host_avatar`/`confirmed_rsvps`).
  - CSS-gradient avatar colors were invalid in React Native.
  - Push registration crashed.
  - Sessions over 2 KB failed to persist.
  - The app could not bundle at all (unused NativeWind needed a Reanimated 4 plugin; removed).
  - The Expo CLI crashed on an ajv version conflict.
  - Sentry 8 was too new for SDK 51.
- Design system, all screens and signature moments (docs/STATUS.md lists every feature, file and backend route).
- Supabase migration + seed + push-dispatch Edge Function for Phase 3 features and store compliance.
- 154 unit tests (fees match production, API route contract, QR, recurrence, clustering, formatting); CI now
  type-checks, lints, tests, bundles iOS + Android and parses the SQL.
- Docs: CLAUDE.md, STATUS, PAYMENTS, SECURITY, STORE (listings, privacy labels, launch checklist), REVIEW, deeplinks.

**Not finished / needs you or the server**
- Apply `supabase/migrations/20261015000000_native_features.sql` (dev project first). Until then, churches, Prayer
  Wall, verses, Serve, reports, settings and account deletion show "coming soon".
- `.env.local` uses a **live** Stripe key: switch to `pk_test_` for testing (plan: test mode until Phase 5).
- `eas init` (project id for remote push), Google Maps Android key, Sentry DSN.
- Server/web: wallet signed link, payout history, ticket-type update endpoint, `price=0` fee bug,
  `.well-known` files + `/event/:id` redirect, old RLS policies scoped to `service_role` (docs/SECURITY.md).
- Nothing has been run on a physical device yet in this session — screens are verified by type-check, lint,
  unit tests and a full iOS/Android bundle build only.

**Test on your phone (`npx expo start`, Expo Go)**
1. Onboarding (3 steps) → browse as a guest → sign in with the email code (terms checkbox required).
2. Home: verse card, Your week, Happening tonight carousel snap, category rails; pull to refresh; light/dark
   (Settings → Appearance) and `/styleguide`.
3. Free event: RSVP → light burst + haptic + ticket lands in Tickets; cancel RSVP.
4. Paid event (test key): Get tickets → see ticket, 7% fee and tax as separate lines → pay with test card
   4242 4242 4242 4242 → ticket in Tickets → open QR (screen brightens) → request refund.
5. Host: create a free event through the 4 steps with live preview → publish → scan your own ticket QR from a second
   phone → green flash. Sales screen numbers vs Stripe test dashboard.
6. Community: post with a type label, double-tap to Amen, report a post, block a user.
7. After applying the migration: Prayer Wall (pray, mark answered → testimony in feed), church page + Home Church,
   Serve sign-up + volunteer QR, Settings → notifications toggles, Delete account on a test account.
