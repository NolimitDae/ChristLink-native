# Progress log

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
