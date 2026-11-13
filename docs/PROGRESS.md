# Progress log

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

## 2026-10-20 — Expo SDK 51 → 58 upgrade and audit fixes

Upgraded one SDK at a time (`npx expo install expo@^N --fix`, `npx expo install --fix`, `expo-doctor`), with
typecheck, lint, tests and iOS + Android `expo export` green after every step. Final: expo 58.0.16, React Native
0.88.0, React 19.3.0, expo-router 58.0.24, TypeScript 6.0, Jest 30, Reanimated 4.7.1 + react-native-worklets 0.13,
Sentry 8.28, Stripe RN 0.81, react-native-maps 1.29.11, gesture-handler 3.3, screens 4.30, safe-area-context 5.10,
svg 15.16. New Architecture and Hermes V1 are the default (no config needed). `expo-doctor`: 20/20 checks pass.

**Breaking changes fixed, per SDK**
- 52 (RN 0.76, React Navigation 7): `sceneContainerStyle` on Tabs → `screenOptions.sceneStyle`. `splash` in
  app.json (deprecated) → `expo-splash-screen` config plugin. Intermediate expo-router 4/5 builds needed the
  transitive `query-string`; no longer needed from SDK 55, so nothing was added.
- 53 (React 19, RN 0.79): TS 5.8 narrows `filter(type => type !== 'All')`, so the Home category rails needed an
  explicit `EventType` type; RN fetch `AbortSignal` type cast in `lib/api.ts`; notification handler
  `shouldShowAlert` → `shouldShowBanner` + `shouldShowList`. `expo export` now refuses an output dir outside the
  project. Added the `expo-web-browser` config plugin that the install step asked for.
- 54 (RN 0.81, Reanimated 4): installed `react-native-worklets` (babel-preset-expo adds its plugin, so
  babel.config.js is unchanged); `Notifications.removeNotificationSubscription` removed → `subscription.remove()`.
- 55 (RN 0.83, New Architecture only): react-native-maps prop `showsPointsOfInterest` → `showsPointsOfInterests`;
  `useColorScheme()` can return `'unspecified'` (`resolveScheme` accepts any string).
- 56 (RN 0.85, expo-router drops React Navigation): ran the expo-router codemod (TabBar types now from
  `expo-router/js-tabs`); `StyleSheet.absoluteFillObject` removed → `absoluteFill`; jest-expo needs
  `@react-native/jest-preset`. Passed straight through 56 (Hermes V1 memory regression) to 57.0.9+.
- 57 (RN 0.86): no code changes.
- 58 (RN 0.88 strict TS API): refs use `ViewInstance` / `ScrollViewInstance` / `TextInputInstance`;
  `StyleSheet.NamedStyles` removed (`makeStyles` constraint now derives from `StyleSheet.create`); custom tab bar
  props are `emitter` + `navigateToTab` (no `navigation`); `react-test-renderer@19.3.0` added for Testing Library.
- Tooling: `.npmrc` with `legacy-peer-deps=true` (eslint 10 vs eslint-plugin-react peer conflict made plain
  `npm ci`, and so EAS builds, fail); CI on Node 22; eas.json uses the `latest` build image (JDK 17+, Xcode 27,
  which satisfies Apple's "Xcode 26 or later" rule). Removed unused `@testing-library/jest-native`.

**Audit fixes**
- ErrorBoundary sends errors to Sentry (`captureException` with the component stack).
- Sign-out cancels all scheduled local reminders, not just the stored ID map.
- Event create: ticket tiers are tracked per draft tier (key → server id), so retrying publish never duplicates
  tiers, and edits after a declined listing fee are sent with the new `updateTicketType`
  (`PATCH /api/ticket-types/:id`, new backend only; contract test row added).
- Saved events and hidden posts reset and reload on user change; the Tickets tab clears another user's tickets.
- Push taps that cold-start the app are routed (`useLastNotificationResponse`, once navigation is mounted).
- A deep link or push tap on first launch is remembered through onboarding and opened afterwards.
- Admin test push moved out of the screen into `sendTestPush` in `lib/notifications.ts`.
- Segmented control: 44pt segments, labels shrink/wrap, the bar grows instead of clipping at large text.
- Ticket screen brightness restore waits for the raise to finish (no stuck full brightness).
- On-image theme tokens (`onImage`, `onImageMuted`, `onImageGold`, `onImageHairline`, `onImageBorder`, `scrim`,
  `scrimStrong`, `stage`, `onStatus`) replace hardcoded colors in scan, gallery, RSVP celebration, DateBlock,
  Badge, IconButton and EventCard. EventHero parallax is off with Reduce Motion.
- Android App Links now cover `www.christlinksocial.com/church`.

**Not finished**
- Everything native needs a new development build (`eas build --profile development`) and a phone test: SDK 58
  Expo Go only runs SDK 58. Not run on a device in this session.
- Ticket tiers deleted from the draft after a partial failure are not deleted on the server.
- The tier update only works once the new backend ships `PATCH /api/ticket-types/:id`; on the old API an
  edited tier after a failed publish gets a 404 (unchanged tiers are skipped, so plain retries still work).
- ProfileHero still has hardcoded on-image colors (outside this audit's list).

**Test on your phone (dev build)**
1. Sign in, background the app, send a push from Admin → Tools, force-quit, tap the push → it opens the right screen.
2. Fresh install, open an `https://christlinksocial.com/event/<id>` link → finish onboarding → the event opens.
3. Paid event create with a card that declines → edit a tier price → publish again → one set of tiers, new price.
4. Sign out / sign in as another user: Saved, hidden posts and Tickets show only that user's data; reminders gone.
5. Ticket QR: open and swipe away fast → brightness returns to normal. Reduce Motion on → event cover doesn't
   parallax. Largest text size → segmented controls readable. Android release build: Stripe, Sentry and maps
   still work with R8 minify (on by default in SDK 58).

## 2026-10-20 — Railway backend replaces server.js + Supabase; app ready for phone testing

**Changed** (branch `claude/railway-launch`, deployed to Railway project "ChristLink Staging")
- Plan: docs/LAUNCH.pdf added; docs/BACKEND.md is the backend architecture + API contract; CLAUDE.md updated (A.1);
  dev builds warn on a `pk_live_` Stripe key.
- `backend/` NestJS API at parity with server.js's 100 routes plus every former Supabase feature (churches,
  prayers, verses, serve, reports, blocks, settings, push tokens, account deletion): email-code auth with rotating
  refresh tokens (Resend), Cloudflare R2 uploads, Stripe payments/Connect/webhook, BullMQ worker (pushes, emails,
  scheduled publish, daily prayer summary). Same table/column names as production, so data copies straight across.
  Fixes from plan step B.1 are in the new backend: signed Apple Wallet link, hidden RSVPs honored, `price=0` fees,
  ticket-type update route, push notifications for purchases/refunds/forum/verification. Also fixed server.js bugs:
  check-in without a host check, double refunds, draft events visible to anyone, last-spot RSVP race, reply counts.
- Tests: backend 43 unit + 110 contract + e2e suites (local Postgres/Redis via docker compose); app 220 tests.
  `backend/test/contract.e2e-spec.ts` fails if any route the app calls is missing.
- App: Expo SDK 51 → 58 (section above), audit fixes, Supabase removed — sign-in and all features use the API
  (`lib/session.ts`), sign-out removes the phone's push token, Apple Wallet button on iOS tickets.
- Data copy tools: `backend/scripts/import-supabase.mjs` (production dump → Railway) and `copy-storage.mjs`
  (Supabase Storage images → R2, rewrites URLs). Tested on a synthetic dump, not on real data yet.
- Staging verified live: health, every route group, sign-up → code → profile, settings, anonymous prayer,
  community post, admin guard (403), refresh rotation + reuse rejected, account deletion; worker runs jobs.

**Not finished / needs you** — see the checklist in the session summary (Railway secrets, Stripe test webhook,
R2 bucket, `.env.local` test key, production dump, Expo Go test, `eas init` + dev build). Production (project
"ChristLink") is untouched: merging this branch to `master` deploys the new backend there, so set production
variables first and don't merge until phone testing passes. The website still runs on server.js + Supabase.

**Test on your phone**: docs/PROGRESS.md test flows 1–6 above, now against staging; plus Prayer Wall, churches,
Serve, Settings → notifications and Delete account (on a test account).

<!-- Sessions below ran on branch claude/blissful-mccarthy-qc0y20 (SDK 51 + Supabase) before the switch. -->

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

## 2026-10-28 (later) — App moved to the Railway backend; Android build fixes

**Decided (owner):** Supabase is retired. The app uses the Railway backend from `claude/railway-launch`; the Supabase
migration applied earlier today stays (harmless while the website still runs on Supabase).

**Changed** (branch `claude/blissful-mccarthy-qc0y20`)
- Merged `claude/railway-launch` and took its tree as-is (Expo SDK 58, Supabase removed, NestJS backend).
- Expo SDK 58 patch updates (`expo install --fix`); expo-doctor 20/20; added `expo-dev-client`.
- eas.json: public config from EAS environments; Sentry upload off in every profile (production had it on).
  EAS variables: development + preview → `https://christlink-api-staging.up.railway.app`, production →
  `https://christlink-api-production.up.railway.app`; the Supabase variables were deleted.
- app.config.js stops an EAS build that has no `EXPO_PUBLIC_API_BASE`.
- `plugins/withStripeTapAndPayExclude.js`: Android release builds failed because Stripe RN pulls Google's
  issuer-only `play-services-tapandpay`; the plugin excludes it and adds R8 `-dontwarn` rules for Stripe's
  compile-only push-provisioning classes (the app never adds cards to Google Wallet).
- docs/BUILDS.md rewritten for Railway; CLAUDE.md deploy notes.
- Android preview build 153ecab1 finished (SDK 58): API = Railway staging, no Supabase, update channel `preview`.
- Staging checked live with a throwaway account: sign-in code → verify → profile, settings, verses, events, prayers,
  tickets all 200; account deleted afterwards. **Staging has no Resend key**: codes are only written to the
  server log, so nobody can sign in until `RESEND_API_KEY` is set.

**Not finished / needs the owner**
- Railway staging variables: `RESEND_API_KEY` (+ verified sending domain), Stripe test secret + webhook secret,
  R2 bucket keys (uploads).
- `EXPO_PUBLIC_STRIPE_PK` (pk_test) in the development EAS environment.
- Copy real data: `backend/scripts/import-supabase.mjs` needs the Supabase database connection string.
- Production: the `ChristLink-API` service deploys `backend/` from `master`; set its variables before any merge.
- Two databases until the website moves off server.js + Supabase: users and RSVPs made in the app won't show on the
  website and the other way round.

**Test** (Android APK from build 153ecab1, after `RESEND_API_KEY` is set on staging)
- Sign in with an email code, browse events, RSVP to a free event, open the ticket QR, post on the Prayer Wall,
  change a setting, sign out and back in.

## 2026-10-29 — UI demo screenshots (no app code changed)

**Changed**
- Nothing in the repo. Rendered 15 screens with Expo web in a throwaway copy (react-native-web plus stand-ins for
  Stripe, maps, secure storage and notifications) at iPhone size, with sample events, posts, prayers and a ticket
  injected in the browser. No request reached staging.

**Noticed (check on a phone)**
- Explore: the first filter-chip row (Near me / Free / Paid / Online) looks clipped at the bottom by the type row.
  Could be web-only.
- The floating tab bar is see-through on web (no blur); on iOS/Android `expo-blur` should cover the content.

## 2026-10-29 (later) — Ticket notches and a slimmer tab bar (owner feedback)

**Changed**
- Ticket notches: the side circles were full outlined rings sitting on the card edge. `TicketPerforation`
  (components/ui/Card.tsx) now draws clean half-circle cutouts that cover the card border; used by the ticket
  screen and the Tickets list card (`TicketShell`). Cards keep their shadows (no clipping).
- Tab bar: 64 → 54pt, the + (Host) button is a 42pt gold circle inside the bar (no raised button or dark ring),
  icons 21pt, smaller active dot. The bar sits on its own layer (`zIndex`/`elevation`) and is solid on Android and
  web, where there is no real blur, so scrolled content no longer ghosts through. iOS keeps the frosted blur.
- Checked in the web demo, dark and light: Home, Explore, Tickets, ticket QR, Host.

**Test on a phone**
- Ticket screen and Tickets tab: notches read as cutouts on both edges, in dark and light mode.
- Tab bar: every tab and the + are easy to hit (each tab keeps a full-height touch area); content scrolls fully
  above the bar; on iPhone the blur still shows.

## 2026-10-29 (evening) — Docked tab bar: Discover, Events, Tickets, Community, Profile (owner mockup)

**Changed**
- `components/TabBar.tsx`: docked full-width bar (hairline top border, `bgElevated`), five labelled tabs, gold
  when active. Discover = the former Home screen, Events = Explore (title renamed "Events"), Tickets, Community,
  Profile. Screens now end above the bar, so the 120–140pt bottom paddings and the Explore/Prayer Wall offsets for
  the old floating bar were removed.
- New `components/icons/TicketIcon.tsx`: tilted ticket with notched sides, dotted tear line and two print lines;
  outline when inactive, filled gold with knocked-out details when active.
- Profile is now a tab (`app/(tabs)/profile.tsx`, no back button). Host left the bar: it stays a hidden tab, opened
  from a new "Host dashboard" / "Host an event" button on Profile (and existing links); Profile stays highlighted
  there, and tapping Profile from Host goes back.
- CLAUDE.md design rule updated (docked bar, no extra bottom padding).

**Test on a phone**
- All five tabs switch; labels sit on one line at the largest text size; home indicator area is not covered.
- Profile → Host dashboard → Create an event; tapping Profile returns.
- Lists on every tab scroll to their last item with no big empty gap at the bottom.

## 2026-10-29 (night) — Back to the floating tab bar (owner)

**Changed**
- `components/TabBar.tsx` floats again (56pt frosted pill, solid off iOS, on its own layer) and keeps the five
  tabs and the new ticket icon. Labels 10.5pt so "Community" fits in a fifth of the pill.
- New `useTabBarClearance()` replaces the hard-coded 120–140pt paddings: Discover, Events, Tickets, Community
  (feed + Prayer Wall button), Profile and Host pad their content by the bar height + offset + a small gap.
- CLAUDE.md design rule updated.

**Test on a phone**
- The last item of every tab list scrolls fully above the bar; the Prayer Wall "Share a prayer" button sits above it.
- At the largest text size the five labels stay on one line.

## 2026-10-29 (late) — Sliding active capsule on the floating tab bar (owner reference)

**Changed**
- `components/TabBar.tsx`: a gold capsule (`goldDim` fill, `goldHairline` edge) sits behind the active tab and
  springs to the new tab on change (jumps with Reduce Motion). Outline icons in every state; active = gold,
  inactive = ivory/ink. Bold 10.5pt labels, 60pt bar with a gold hairline edge, 10pt side margins.
- Kept brand colours instead of the blue in the reference, and the five tabs + ticket icon.

**Test on a phone**
- Switch tabs quickly: the capsule follows without overshooting badly or lagging; with Reduce Motion on it jumps.
- "Community" fits inside its capsule at the default text size.

## 2026-10-29 (late night) — Edit profile: every website profile option (owner request, UI unchanged)

**Changed**
- `components/profile/EditProfileSheet.tsx` now edits everything the website's Edit Profile has, with the existing
  components (Field, Chip, ChipRow, Avatar): avatar color (8 web gradients), profile ring (none + 9 colors), name,
  city, bio, Instagram, Facebook, TikTok, favorite verse + reference + translation, hot takes (300), hobbies &
  interests (20 chips), open to connect (10 chips), prayer request (400, was 500, matches web), latest testimony (600).
  Avatar photo and banner stay on the profile header (camera buttons).
- `lib/profileOptions.ts`: option lists in the website's stored format (hobbies = labels joined by ", " in list
  order, connect_tags = web ids such as `bible`, `new-friends`), social-link normalizing; 14 tests.
- Backend unchanged: PATCH /api/profile already accepted every field.
- Checked in the web demo: the PATCH body matched the website format exactly.

**Not done**
- The app's public profile screens don't display hobbies, connect tags, hot takes or testimony yet.
- Teal avatar gradient and 7 ring colors are matched by eye (not present in the live data); the website may use
  slightly different hex values.

**Test on a phone**
- Edit profile: pick a color and ring, tick hobbies and connect options, change translation, save, reopen: all kept.
- Open the same account on christlinksocial.com: hobbies and connect options show as selected there too.

## 2026-10-30 — Icon audit (owner request)

**Found** (135 distinct icons, 389 uses; all names valid)
- Prayer used a raised hand ("stop"/high-five) and, elsewhere, a heart and a flame for the same count; Amen used the
  same heart as saving an event; churches used an office building; Serve/volunteer had four different icons;
  Roller Skating was a bicycle; Mentorship and Bible study had two icons each; Blocked accounts used a raised hand.

**Changed**
- New `components/icons/AppIcon.tsx` + generated `glyphs.ts`: praying hands, church, hand-with-heart (Phosphor, MIT)
  and Bible, roller skate (Tabler, MIT), outline + solid. `Button`, `IconButton`, `Chip`, `ListRow`, `ActionMenu`,
  `RequirementCard`, `HostEventRow`, `EventSections` and onboarding `Steps` accept them.
- Prayer/Amen → praying hands everywhere (prayer cards, counts, Discover row, posts, notifications, onboarding,
  profile options). Church → church glyph (Settings, Profile, onboarding, serve, notifications, Prayer Wall toggle).
  Serve/volunteer → hand with heart. Verse of the day / Bible study → Bible. Blocked accounts → `ban-outline`.
  Answered post type → sparkles (matches the Answered banner). Payouts → wallet in all three places.
  Profile options: Traveling → airplane, Community Outreach → megaphone, Family → home, Meet up → calendar.
- docs/ICONS.md (concept → icon table), CLAUDE.md rule, `/styleguide` "Faith icons" block.

**Test on a phone**
- Prayer Wall, Discover prayers and community posts show praying hands; double-tap a post shows the praying-hands burst.
- Settings, Profile and onboarding church rows show the church glyph; custom glyphs look crisp at small sizes.

## 2026-10-30 — iPhone build on hold (owner: skip Apple for now)

- Checked: the Expo account has a valid Apple distribution certificate (team QKP52JF8KD, from Vendly, until
  2027-05-10) and the owner's iPhone is registered, but no provisioning profile for `com.christlink.app` and no App
  Store Connect API key, so iOS builds can't be created from a cloud session.
- To resume later: run `eas build --profile preview --platform ios` once on a computer (Apple sign-in), or add an App
  Store Connect API key (Admin) as environment variables `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_ASC_API_KEY_P8`.
- Android preview build 153ecab1 + over-the-air updates remain the test path.

## 2026-10-30 (later) — iPhone testing through Expo Go (no Apple credentials)

- Published an Expo Go update: `EXPO_GO_UPDATE=1 eas update --branch expo-go --environment development`
  (runtime `exposdk:58.0.0`, update group 2eafab20-13ea-48f8-8628-e1651bec8e90, API = Railway staging).
  Open on iPhone: `exp://u.expo.dev/d64de815-22a9-48e7-8e89-f1da181fab6a/group/2eafab20-13ea-48f8-8628-e1651bec8e90`
  or the QR on the EAS dashboard update page.
- Every native package the app imports ships in Expo Go except Sentry, which runs JS-only (no DSN set anyway).
- Expo Go limits: no Apple Pay, no remote push; the app icon/splash are Expo Go's. Republish the same command after
  JS changes (a new link each time; the dashboard lists them).

## 2026-10-30 (evening) — App Store Connect key added; Apple membership is inactive

- The owner added `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_ASC_API_KEY_P8` (key body only; the session adds the
  PEM header/footer when writing it to a temporary file). The key is valid: App Store Connect `/v1/apps` returns 200.
- Apple refuses every certificate/profile/device call: "Team ID 'QKP52JF8KD' is not associated with an active
  membership." The Apple Developer Program membership has lapsed, so no iPhone build can be signed (cloud or local)
  until it is renewed at developer.apple.com/account → Membership details.
- After renewal: EAS non-interactive won't pick devices for internal distribution, so create the `com.christlink.app`
  App ID and an ad hoc profile (cert PN5AQA5DBR, the registered iPhone) through the App Store Connect API, store it in
  EAS credentials, then `eas build --profile preview --platform ios --non-interactive`.

## 2026-11-01 — Improvements from competitor research (Eventbrite, Luma, Partiful, Dice, YouVersion, Hallow, Echo, Church Center)

**Changed**
- Bug: Discover "Your week" showed Sunday twice on the day clocks fall back (24-hour steps). `weekDays()` now uses
  calendar days; Jest now runs in America/New_York (jest.globalSetup.js) so DST bugs fail tests.
- Add to calendar: event menu, a "Add to calendar · Directions" row for people going, ticket screen, and church
  visits. Uses the system "new event" sheet (expo-calendar, no calendar permission) and falls back to Google
  Calendar on builds made before expo-calendar was added (lib/calendar.ts). Directions open Apple Maps / Google
  navigation (lib/maps.ts).
- Ticket screen keeps the phone awake while the QR is open (expo-keep-awake), next to the existing brightness boost.
- Prayer Wall: "Remind me to pray tomorrow" / "daily for a week" (local 9am reminders, permission asked on tap),
  "Stop prayer reminders"; deleting a prayer cancels them.
- Verse of the day: gentle habit row — this week's dots and "N days in a row" / "Perfect week", stored on the device
  (lib/streak.ts). No loud resets.
- Kindness nudge (Instagram-style): posts, replies, event discussion and prayers with insults, profanity, threats or
  shouting get "Is this kind and true?" with Edit / Post anyway (lib/kindness.ts). Reports stay the moderation.
- Church pages: "Plan a visit" sheet for non-members — pick one of the next services (two weeks), add it to the
  calendar, reminders 24h/2h before, directions.
- Onboarding: new "What draws you in?" interests step; Settings → Discover → Interests edits them; Discover puts
  those categories first (lib/interests.ts).
- Chips get a 4pt hit slop (44pt touch targets).

**Needs a new build** (JS works over the air with fallbacks until then): expo-calendar (native "add event" sheet)
and its app.json plugin. Current Android APK uses the Google Calendar fallback.

**Not done (need backend)**: waitlist for sold-out events, "someone prayed for you" real-time push per tap
(the daily summary exists), church connect card to the church admin, Google Wallet.

**Test on a phone**
- Discover: week strip days are consecutive; verse card shows the dots row after it loads.
- Event you RSVP'd to: "Add to calendar" and "Directions" under the host; "…" menu → Add to calendar.
- Ticket: Calendar / Directions buttons; screen doesn't sleep while the QR is open.
- Prayer Wall → "…" on a prayer → Remind me tomorrow (allow notifications) → menu now shows "Stop prayer reminders".
- Post "you are an idiot" in Community → kindness prompt; Edit keeps the text.
- A church page with service times (not your Home Church) → Plan a visit.
- Fresh install / reset onboarding → interests step; Settings → Interests.

## 2026-11-01 (later) — Backend: waitlist, "prayed for you" push, church visit cards, Google Wallet

**Changed (backend/, with e2e tests; app wired with graceful fallbacks until staging has it)**
- Waitlist (`/api/events/:id/waitlist`, migration `20261101000000_event_waitlist` adds `status` to the website's
  existing `event_waitlist` table). Free events: a cancelled RSVP or a raised capacity RSVPs the next person
  automatically and pushes "You're in". Paid events: a refund or more tickets pushes "Tickets are available" to the next
  people (a notice holds its seat for 12 h). App: "Join waitlist" / "On the waitlist · You're #3 in line" on full and
  sold-out events.
- Instant "Grace prayed for you" push on each new pray tap; further taps within 6 h update the same unread inbox row
  ("3 people prayed for you") without another push. Blocked users never trigger it. The daily summary stays.
- Church visit cards (`/api/churches/:id/visits`, migration `20261101010000_church_visits`): Plan a visit can tell the
  church (party size, note, optional email); the owner gets a push and a "Planned visits" list on the church page.
- Google Wallet (`/api/tickets/:id/google-wallet-link`): creates the class/object via the Wallet REST API and returns a
  short save link; Android ticket screen shows "Add to Google Wallet". Needs `GOOGLE_WALLET_ISSUER_ID` and
  `GOOGLE_WALLET_KEY_JSON_BASE64` in Railway (503 until then; the app says passes are coming soon).
- Backend checks: typecheck, 49 unit, 161 e2e, build, and `prisma migrate diff` (empty) all pass.

**To deploy**: staging deploys from `claude/railway-launch`; these commits are on `claude/blissful-mccarthy-qc0y20`.

**Test on a phone (after staging deploy)**
- Fill a free event (capacity 1), join the waitlist from a second account, cancel the first RSVP → second account gets
  "You're in" and the RSVP shows in Tickets.
- Pray for someone's prayer → they get "<name> prayed for you" right away.
- Plan a visit on a claimed church with "Let them know" on → the owner sees it under Planned visits.
- Deploy: owner approved; `claude/railway-launch` was fast-forwarded to 2ea1f39 (2026-11-01 05:07 UTC), but Railway
  staging did not start a build from the push (last staging deploy is still dcf01c1 from 2026-10-20). In Railway →
  ChristLink Staging → ChristLink-API and ChristLink-Worker → Settings → Source, check the trigger branch is
  `claude/railway-launch` with auto-deploy on, or press Deploy on the latest commit. The pre-deploy step runs the two
  new migrations (additive: a column + index on `event_waitlist`, a new `church_visits` table).

## 2026-11-02 — Web preview of the app (sample data) at https://christlink.expo.app

- The real app screens now build for the web: `metro.config.js` swaps Stripe, Maps, SecureStore and Notifications for
  stand-ins in `web-preview/stubs/` on web only; `expo-router` async routes are off for web (EAS Hosting doesn't
  serve chunk files named like `[id]-….js`).
- `EXPO_PUBLIC_DEMO=1` web builds load `web-preview/demo.tsx`: sample data for every screen, a signed-in sample user,
  interactions that change state until reload, and a phone frame on wide screens. Deployed with EAS Hosting
  (`npm run web:preview && npx eas-cli deploy --prod`; docs/WEB-PREVIEW.md).
- Checked: app tests/typecheck/lint, Android bundle still exports, and every main screen on the deployed site with no
  page errors.
- Not in the preview: payments, notifications, maps, camera.

## 2026-11-02 (later) — Add your church; web filter bar fix

- Onboarding "Find your Home Church": "Can't find your church? Add it" (and an "Add your church" action when a search
  finds nothing) opens a short form (name, city, state, optional address and denomination, "I'm a pastor or on staff
  here"). Members' listings stay unclaimed (backend `POST /api/churches { as_member: true }`), so the real leaders can
  still claim the page; the same name in the same city returns the existing church instead of a duplicate. Guests'
  churches are created and set as Home Church right after sign-in (components/onboarding/pendingChurch.ts).
- Web: horizontal chip rows no longer get squeezed (Explore filter bar was cut off); the web preview hides scrollbars
  and focus outlines.
- Needs the backend change on staging (`as_member`); until then a member who adds a church becomes its owner.
- Fixed: other people's profiles crashed when the name was missing (`full_name.split`); a malformed profile now
  shows the "couldn't load" state. Web preview has sample public profiles and follow/unfollow.
- Fixed: event header photo slid below the hero while scrolling (parallax without a bottom clip), showing behind the
  title and "Hosted by" — very visible in light mode. The photo is now clipped at the hero's bottom edge; the pull-down
  stretch still has room above.

## 2026-11-02 (evening) — Motion and polish pass (Apple "Designing Fluid Interfaces")

- `lib/motion.ts`: springs described by damping ratio + response (`SPRING.press/move/sheet/momentum/pop`),
  momentum projection and rubber-band helpers (tested).
- Press feedback on touch-down for buttons, cards, event cards, chips and tab icons (`PressScale`: shrink in 90 ms,
  settle back critically damped; Reduce Motion dims instead). Buttons no longer bounce on release.
- Tab bar highlight and segmented control: critically damped (a tap has no momentum, so no overshoot).
- Bottom sheets: grab mid-animation from where they are, 1:1 drag with the backdrop dimming as you pull, rubber-band
  upward (sheet extends below the screen so no gap shows), dismiss decided by projected landing point, and the exit
  continues at the finger's speed; otherwise it springs back with the release velocity.
- Save heart pops in (small earned bounce) on the same frame as the haptic.
- Content that replaces a skeleton rises and fades in, staggered (Discover rails, Tonight, Events list first screen,
  Tickets wallet and memories); Reduce Motion: cross-fade only.
- Serif title tracking tightened slightly at 24/20 pt.
- Test on a phone: drag a sheet down slowly (follows, backdrop lightens) vs. a quick flick (closes at your speed);
  pull a sheet up (resists); press and hold an event card (shrinks immediately); save an event (heart pops).

## 2026-11-02 (night) — Profiles show what people shared

- Other people's profiles (and your own) now show "Open to" (connect tags), Hobbies, Testimony, Hot takes and social
  links from Edit Profile (`components/profile/ProfileDetails.tsx`; empty sections are hidden), plus a "Prayers" list of
  their Prayer Wall prayers with "I prayed" and report.
- Backend: `GET /api/prayers?author=<id>` (never that person's anonymous prayers, except to themselves); the app also
  filters by author so an older API can't show other people's prayers there.

## 2026-11-02 (late) — Performance pass

**Changed — backend**
- Notification fan-outs (new event to followers, invites, serve messages, friend RSVPs, answered prayers, daily prayer
  summary, waitlist) were N+1: one insert + one queue job per person. Now `NotificationsService.createMany`: one bulk
  insert + one bulk queue add per 500.
- Migration `20261103000000_query_indexes`: feed by date/author, prayers by author/church, prayer_prays by date/user,
  notifications by user+date, serve shifts/sign-ups, block/follow/church-event reverse lookups, confirmed RSVPs.
- gzip/Brotli response compression (`compression`, > 1 KB) — e2e tested (`test/perf.e2e-spec.ts`).
- Redis read-through cache (`src/cache`): public event lists 30 s (dropped on publish/edit/hide/delete), verse of the
  day 10 min (dropped on admin edits). Fails open if Redis is down.
- Timeouts on every external call: Stripe 20 s (+1 retry with the same idempotency key), Resend 10 s, Expo push 15 s,
  Google Wallet 10 s (geocoding already had 5 s). pg pool: `DB_POOL_MAX` (10), 5 s connect timeout.
- Uploaded images are resized (avatars 600 px, others 1600 px) and stored as WebP with `sharp`; falls back to the
  original if it can't decode (e.g. some HEIC). Public files already had 1-year immutable cache headers on R2 (CDN).
- OpenTelemetry (`src/tracing.ts`): http, express, Nest, pg (every SQL query), ioredis spans; on only when an OTLP
  endpoint is set — Railway sets it when tracing is enabled on the service. Verified exporting with a local collector.
- Caught before shipping: `import compression from 'compression'` type-checks but crashes at startup in this CJS
  build; it's `import compression = require('compression')`.

**Changed — app**
- Concurrent identical GETs share one request (`apiFetch` in-flight de-dup; writes never shared; tested).
- Community feed and Prayer Wall load more pages while scrolling (offset / `before` cursor), with skeleton footers.
- Someone's profile loads the profile, their events and their prayers in parallel.

**Already in place (checked, no change)**: skeleton loaders everywhere, 300 ms debounced searches, retries for GETs
only, request timeouts in `apiFetch`, optimistic updates (pray, amen, follow, save), virtualized lists (FlatList for
feed, events, rails), memoized contexts and list items, BullMQ for push/email/scheduled jobs, API + Postgres + Redis
in the same Railway region (us-west2), fonts bundled in the app (self-hosted, 4 Montserrat weights all used),
no unused dependencies (depcheck).

**Not applicable to a native app**: AI streaming (no AI features), server/build-time page rendering, third-party
script loading, browser caching and per-page JS splitting (the app's JS ships inside the build). The web preview is a
single 4.5 MB (1.1 MB compressed) bundle: ~3.4 s on fast networks, ~18.5 s on slow 3G with 4x CPU throttling
(measured with Playwright); fine for a demo, and the real site is a separate project.

**Recommendations, not changed**: run 2 API replicas on production (the API is stateless: sessions, rate limits and
queues are in Redis/Postgres); turn on Railway tracing for ChristLink-API; set `SENTRY_DSN`/`EXPO_PUBLIC_SENTRY_DSN`
for real-user crash and speed data (the app already samples 20% of sessions when a DSN is set).
- Staging: pushed d368a75 to `claude/railway-launch` and turned on Railway tracing for ChristLink-API (staging only).
  Because neither staging service has a branch linked (Railway shows `branch: null`), enabling tracing redeployed the
  API from `master` (old f962774). It was rolled back within ~3 minutes by redeploying the previous build (11230a1);
  data was untouched. **To do (owner):** in Railway → ChristLink Staging → ChristLink-API and ChristLink-Worker →
  Settings → Source, set the branch to `claude/railway-launch` (reconnect GitHub if branches won't load), then Deploy
  the latest commit. Tracing spans appear once the d368a75 build (with src/tracing.ts) is live.

## 2026-11-03 — Fix: onboarding showed twice

- Finishing or skipping onboarding saved the flag and navigated to the tabs in the same moment; the root layout's
  in-memory flag was still "not done", so it redirected straight back to onboarding (reproduced on the web preview:
  onboarding reappeared after both "Get started" and "Skip"). The redirect now re-reads storage first
  (app/_layout.tsx). Verified: both paths land on Discover and stay there; a fresh install still starts onboarding.

## 2026-11-03 — New typefaces: Newsreader + Instrument Sans

- Researched type that doesn't read as AI/template-made: avoid defaults (Inter, Roboto, Open Sans, Lato, Arial) and
  the faces AI tools now reach for instead (Space Grotesk, Satoshi, Clash Display, Geist, Plus Jakarta Sans);
  Montserrat is a template staple and wide at small sizes.
- Titles and verses: **Newsreader Medium** (screen-first editorial serif) instead of DM Serif Display. Text and UI:
  **Instrument Sans** 400/500/600/700 instead of Montserrat. Both SIL OFL, bundled via @expo-google-fonts; the old
  font packages were removed. One place to change: `fonts` in lib/theme.ts (+ the loader in app/_layout.tsx).
- Checked on Home, event, Prayer Wall, a profile, Tickets and onboarding in light and dark: no clipping or layout breaks.

## 2026-11-03 (later) — Design pass: remove template/"AI" tells

Checked the app against published lists of AI-design tells (avoid-ai-design catalog, Anthropic's frontend guidance)
and changed what applied, within the existing design system:
- Section titles: no decorative gold rule after them; serif titles at 24 pt carry the hierarchy.
- All-caps tracked labels only where they're a convention (event type kicker, calendar month, ticket stub, badges,
  settings groups). Card and section labels are a new sentence-case `label` style ("Verse of the day", "Who's going",
  "Pinned prayer", testimony, event info tiles, Home Church). Dropped redundant eyebrows ("Soon", "1 gathering").
- No icons in tinted squares: event info tiles, onboarding promises, menus and Settings rows use plain line icons;
  gold is kept for real accents.
- Sparkles (reads as "AI") replaced by a checkmark for answered prayers/testimonies (ICONS.md updated).
- No arrows on buttons or links ("Next", "Explore events", "Browse churches"); "→" in Friends this week became words.
  Onboarding's last button says "Go to Discover" instead of "Get started".
- Home sections no longer all fade up the same way (kept only for list rows replacing skeletons).
- Faint text raised to WCAG AA (4.5:1+) in both themes: dark #8F8574, light #726858.

## 2026-11-03 (evening) — Tappable profile numbers

- Your profile: Followers / Following → `app/connections.tsx` (one screen, Followers · N / Following · N switch, both
  lists fetched together, tap a person → their profile); Events hosted → `app/hosted.tsx` (your drafts marked; other
  people's published events); Hours served → `app/serve/history.tsx` (total + each completed shift with its hours).
- Other people's profiles: Followers / Following open the same lists for them.
- Backend: `GET /api/serve/history` (your completed shifts with hours; e2e tested). Followers/following used the
  existing public `/api/followers/:id` and `/api/following/:id` (newest 200).
- Stats now give press feedback (PressScale) and tell screen readers they open a list.

## 2026-11-03 (night) — Apple HIG pass: large titles, minimizing tab bar, quieter haptics

**Changed**
- Type ramp now matches the HIG Large defaults (body/headline/button 17, callout 15, caption 12, label 13,
  display 34, titles 28/22/20) with tighter tracking on the serif titles.
- Discover, Tickets, Profile and Host have iOS large titles: the serif title scrolls away and a frosted compact bar with a
  centered 17 pt title fades in; its hairline appears only while content is underneath (scroll edge effect). Pulling
  down grows the large title slightly. Tapping the compact bar scrolls back to the top. On Android/web the bar is solid
  (no real blur there), so scrolled text never ghosts through it.
- The floating tab bar minimizes while you scroll down through content (labels fade, icons settle to the middle, the
  bar shrinks a touch) and comes back when you scroll up, reach the top or switch tabs. Reduce Motion: labels fade only.
- Haptics follow the HIG: `Button` and `IconButton` no longer buzz on every press; success/error/selection feedback
  stays where something actually happened (RSVP, payment, publish, toggles, segmented controls, tab switches).
- Concentric corners: `concentric()` helper in lib/theme.ts (used by the prayer testimony box; the tab bar capsule and
  segmented control were already concentric).
- Removed the last template tells: tinted icon squares in Notifications, church sections, onboarding church step and
  payouts; section hairlines on the church page.

- Explore (events, churches, serve) and Community (feed, Prayer Wall) lists minimize the tab bar too.
- Long-press any event card → quick actions sheet (Save, Share, Add to calendar, Directions, Open event) with a medium
  impact haptic, like an iOS context menu; screen readers get it as a "Quick actions" custom action. One shared sheet
  (`components/EventQuickActions.tsx`, mounted in app/_layout.tsx), so long lists stay light.
- Menu sheets drop the navigation chevron on their rows (ListRow inside a BottomSheet = menu item).
- Composer shows a character count only in the last 200 characters ("38 left"), not a permanent 0/1000.
- Host: zero stats are no longer gold/green (color only when there's real money or sales); the setup checklist uses
  plain line icons.

**Not finished**
- Explore and Community keep their own headers (search bar and segmented feed) instead of large titles.

**Test on your phone**
1. Scroll Discover, Tickets, Profile and Host: the big title slides away, the compact title fades in with a hairline;
   tap the compact bar → back to the top. Pull down at the top → the title grows slightly and pull-to-refresh still works.
2. Scroll down → the tab bar's labels fade and it shrinks; scroll up a little → it comes back. Switch tabs → full bar.
3. Turn on Reduce Motion: no title growth, the tab bar only fades its labels.
4. Taps on buttons/icon buttons are silent; RSVP, saving an event, toggles and tab switches still give haptics.
5. Long-press an event card anywhere (Discover, Events, Profile) → the quick actions sheet; try Save and Add to calendar.

## 2026-11-03 (late) — Large titles on Events and Community

**Changed**
- Events and Community now use the same 34 pt serif large title as the other tabs (`components/ui/CollapsingHeader.tsx`).
  Their controls (Events/Map/Churches/Serve, Feed/Prayer Wall) stay pinned, so the title isn't part of the list:
  scrolling 40 pt into a list tucks the title away with a spring and the controls slide up under the status bar,
  giving the list ~49 pt more room; a hairline appears under the controls while content runs beneath them. Back near
  the top (or switching segment) the title returns. Reduce Motion: the title stays put.
- Bottom-pinned elements (Share a prayer, the map's event preview card) stay exactly in place in both states
  (`useFloatingOffset`).
- The same scroll handler still minimizes the tab bar.
- Web preview: the map stand-in accepts camera calls (no more `animateToRegion` error on the Map tab).

**Not finished**
- Nothing open from the HIG pass.

**Test on your phone**
1. Events: scroll the list → "Events" slides away, the switch and search move up; scroll back to the top → it returns.
   Same on Churches and Serve; switching to Map brings the title back.
2. Community: same on Feed and Prayer Wall; the Share a prayer button never moves.
3. With Reduce Motion on, the titles never move.

## 2026-11-06 — Logo everywhere it belongs + the website on the new app (accounts kept)

**Changed**
- **Logo** (the refined mark from the logo canvas: open ring + gold cross with a rounded tip, CHRISTLINK / SOCIAL
  wordmark). `scripts/brand/build-brand.mjs` generates everything from one source: the in-app `Logo` / `LogoMark`
  components (outlined wordmark, no extra fonts), SVG masters in assets/brand, the app icon, Android adaptive and
  notification icons, splash, favicon, web touch icon, link-preview image and email logo.
  Placed on: onboarding welcome, sign-in, share cards, Settings footer, `/styleguide`, the web page icons/preview, and
  the sign-in email header (`EMAIL_LOGO_URL`). Map pins stay pins.
- **Website build** of this app for christlinksocial.com (docs/CUTOVER.md):
  - Real web versions of native-only modules in `web/shims/`: Stripe (Payment Element dialog for tickets, card field
    for the listing fee, bank-redirect returns confirmed on Tickets), sessions in localStorage, the browser's
    date/time inputs (event and church times now work on the web), no-op notifications. Map tab hidden on the web.
  - Old `#event/<id>`, `#user/<id>`, `#forum/<id>` links open the matching page; onboarding isn't forced on the web.
  - `public/index.html` (title, description, link previews, icons, no white flash), `manifest.json`, robots.txt.
  - `web/server.mjs` (no dependencies): serves the build with long caching for hashed files, brotli/gzip, security
    headers, `www` → apex redirect, `.well-known` app-link files from env, and passes Stripe's `POST /webhook` to the
    API so the webhook URL never changes. `Dockerfile.web` + `web/railway.toml` for a new Railway service.
- **Accounts carry over**: the old site already used email codes (no passwords), the import keeps every user id, and
  sign-in matches by email. New `POST /api/auth/legacy-exchange` keeps people who are signed in on the old site signed
  in (Supabase confirms the old session; existing accounts only). The import now stores emails lower-case and refuses
  to run (changing nothing) when an imported profile would lose its login.
- Share cards on the web share text + link (browsers can't capture the image). Home's prayer row no longer calls the
  API for guests and reloads after sign-in.
- Tests: backend 6 legacy-exchange + 2 email tests; app 7 session hand-over, 3 old-link, 6 web-shim tests; 8 web
  server tests (`npm run test:web`, also in CI). Verified end to end in a browser against a local backend: old-site
  session carried over (and kept after reload), old link opened the right page, email-code sign-in, no forced
  onboarding. Import guards checked against a scratch database.

**Not finished / needs you**
- The switch itself (docs/CUTOVER.md): create the ChristLink-Web Railway service, set the production variables, rehearse
  the import on staging, then move the domain. Nothing in production was changed.
- The new app icon and splash need a new native build (`eas build`); everything else ships over the air.
- Stripe: add christlinksocial.com under Payment method domains for Apple Pay / Google Pay on the web.
- Not tested here: a real web payment (no Stripe test key in this environment) and the Docker image build (Docker Hub
  is blocked here; the same steps were run in a clean copy instead).

**Test**
1. Phone (OTA): onboarding welcome, sign-in, Settings footer and a share card show the new logo.
2. https://christlink.expo.app (demo): logo, link preview icon, event creation date/time fields work in the browser.
3. After the website service exists on Railway (its Railway URL, before moving the domain): sign in with your email,
   buy and refund a ticket with a real card, create a draft event with a date and time.

## 2026-11-06 (evening) — Production built out and loaded with the old site's data

**Changed** (details and remaining steps: docs/CUTOVER.md "Status")
- PR #2 merged to `master`. Staging API + worker follow `claude/railway-launch`; production API follows `master` with
  its settings filled in (generated JWT secret; Stripe, Apple Wallet and Supabase values referenced from the old
  ChristLink1 service so nothing secret was copied by hand). New production services: ChristLink-Worker, ChristLink-Web
  (https://christlink-web-production.up.railway.app) and a temporary Data-Copy-Temp job.
- New `backend/scripts/supabase-migrate`: copies the old site's data inside Railway (no database password needed, no key
  leaves Railway). Dry run, then the real copy: 75 accounts and profiles, 12 events, 11 tickets, 69 RSVPs, 64 follows,
  25 event chat posts, 19 notifications, posts, coupons and the host's Stripe account. Production had no data before.
- Checked: production website loads live data; an old `#user/<id>` link opens that member's imported profile; the
  session hand-over reaches the real Supabase; the Apple app-link file is served.

**Not finished / needs you**
- The domain still points at the old site. Blockers: no Resend key on the ChristLink projects (sign-in emails), no R2 keys
  (photo uploads). The DNS change is in Cloudflare.

**Test**
- Open https://christlink-web-production.up.railway.app on your phone and computer; browse Events and a profile.
  (Signing in there works once the Resend key is added.)

## 2026-11-07 — christlinksocial.com switched to the new app

**Changed**
- Production (Railway project ChristLink) now runs this repo from `master`: ChristLink-API (migrated, all settings;
  Stripe/Apple/Supabase values referenced from the old ChristLink1 service), a new ChristLink-Worker, and a new
  ChristLink-Web serving christlinksocial.com. Staging follows `claude/railway-launch` with the same code.
- One-time data copy job (`backend/scripts/supabase-migrate`) runs inside Railway, so no key passed through anyone:
  final copy at the switch = 75 accounts, 75 profiles, 12 events, 11 tickets, 69 RSVPs, 64 follows and the rest,
  identical to the old site. The job is now disarmed (dry run only).
- Uploads refuse cleanly (503) when `R2_PUBLIC_URL` is missing instead of saving broken photo links (PR #3).
- Sign-in emails verified from production (Resend); email header shows the logo.
- Live smoke test: home and an old `#event/<id>` link opened the right page with live data; CORS, Apple app-link
  file and Stripe's `/webhook` path checked.

**Not finished / needs you** (docs/CUTOVER.md → Status)
- `www.christlinksocial.com`: add the CNAME + TXT records in Cloudflare.
- Photo uploads: make the `christlink-media` bucket public (custom domain `media.christlinksocial.com`), then set
  `R2_PUBLIC_URL`; later run `copy-storage.mjs` to move old photos off Supabase.
- Optional: Android app-link fingerprint; Stripe payment-method domain for Apple Pay / Google Pay on the web.
- Delete the Data-Copy-Temp service (production) and the fn-check-temp service (staging) when convenient; keep
  Supabase + ChristLink1 for ~60 days.

**Test**
1. Open christlinksocial.com in a browser where you were signed in on the old site: you should land signed in.
2. Sign out, sign in with your email code: your profile, hosted events and followers are there.
3. Open an old shared link (`christlinksocial.com/#event/<id>`): it opens the event.
4. After `R2_PUBLIC_URL` is set: change your profile photo.

## 2026-11-07 (later) — Fix: social links on profiles didn't open

- Profiles copied from the old website stored links as typed (5 of the 8 social links were like `instagram.com/name`,
  no https), and the profile opened the raw value, so tapping did nothing. Profiles now clean the link when showing it
  (`normalizeSocial`, also used when saving), which also handles `m.facebook.com`, `fb.com`, `instagr.am`, TikTok
  names without `@`, and links to other sites; a link that still fails to open is logged instead of ignored.
- Test: open a profile with Instagram/Facebook/TikTok and tap each (phone and christlinksocial.com).

## 2026-11-07 (later) — Prayer Wall for visitors; honest "couldn't load" messages

- The Prayer Wall empty-state art was an abstract shape that read as a rocket; it is now the app's praying-hands
  glyph (Phosphor hands-praying, thin weight, MIT) at the same line weight as the other illustrations.
- Signed-out visitors saw "Couldn't load prayers — check your connection" on All/Answered: the API answers 401 to
  visitors (prayer requests are members-only), and the screen blamed the connection for every error. Visitors now
  get "Sign in to see the Prayer Wall" on every filter.
- New `lib/loadFailure.ts` + `components/LoadError.tsx`: failed screens say what actually happened — no connection
  ("check your connection"), signed out / session ended (Sign in button) or a server error ("on our side"). Used on
  the Prayer Wall, feed, notifications, followers/following, hosted events, serve history, the event page and the
  onboarding church search. `FeatureError` now carries the HTTP status.
- Test: christlinksocial.com signed out → Community → Prayer Wall → every filter shows the sign-in message with
  praying hands; turn on airplane mode and pull to refresh a list → "check your connection".

## 2026-11-08 — Praying hands with fingers

- Every prayer icon ("I prayed", Prayed, prayer counts, Amen, the Prayer chip) and the Prayer Wall illustration now use
  Material Symbols' rounded "folded hands" (Apache 2.0), which shows fingers and thumbs, instead of Phosphor's
  finger-less praying hands. One glyph source (`PRAY_GLYPH` in components/icons/glyphs.ts): weight 400 for icons,
  weight 200 for the illustration so its line matches the other empty-state drawings. docs/ICONS.md updated.
- Test: Community → Prayer Wall (cards and the signed-out message) and a post's Amen on phone and website.

## 2026-11-12 — App Store readiness

**Changed**
- iOS config for review: privacy manifest (required-reason APIs, no tracking); removed permission prompts the app
  never uses (Face ID, microphone, Reminders, "Always" location, motion, full-accuracy location, the unused
  notifications string); one specific camera purpose string; store builds drop the dev-client local-network keys and
  use production push (`plugins/withAppStoreRelease.js`). Checked with `expo prebuild`.
- All Expo SDK 58 packages on the SDK's expected patch versions. Runtime version is now the native **fingerprint**
  (was the app version), so existing preview builds stop receiving OTA updates until they are rebuilt.
- New Support page (`/support`, christlinksocial.com/support: FAQ + email), linked from Settings. Privacy policy
  updated to the new backend (processors, calendar, location while in use, website). Legal "View on the web" link
  hidden on the website itself.
- Money shows thousands separators ("$1,061.43").
- 6 App Store screenshots (6.9", 1320×2868) in `store/screenshots/iphone-6.9/`, generated from the sample-data
  preview by `scripts/store/screenshots.js`.
- docs/APP-STORE.md: the full App Store Connect sheet (listing copy, keywords, privacy labels, age rating, review
  account + notes, steps). docs/STORE.md rewritten for the current backend (Google Play + launch checklist).
- Production: App Review account `appreview@christlinksocial.com` signs in with the fixed `REVIEW_CODE`
  (Railway → ChristLink-API); live Stripe publishable key added to the EAS production environment.

**Not finished / needs you**
- **Apple Developer Program membership for team QKP52JF8KD is not active** (Apple's API: "Unable to find a team"),
  so no store build, bundle ID, merchant ID or App Store Connect app could be created. Steps in docs/APP-STORE.md.
- Publish a few real upcoming events in production (all copied events are past; Discover is empty).
- Decide on the host listing fee (possible Guideline 3.1.1 issue) and the "Draft — pending legal review" label.
- Optional: Sentry DSN in EAS production.

**Test**
- Settings → Help & support on the phone and christlinksocial.com/support.
- Sign in as the review account on the website with the review code.
- After the next build: camera, photo and location prompts show the new wording; no Face ID prompt.

## 2026-11-13 — Payments check: Stripe webhooks moved to the new backend

- Found that both live Stripe webhook endpoints still called the old server (`christlink1-production…/webhook`, still
  running on Supabase), so the new API never heard about payments, refunds or host onboarding. No live payments had
  happened since the cutover. Both now call `https://christlinksocial.com/webhook` (forwarded to the API, same signing
  secrets); the payments endpoint also sends `charge.refunded` and `charge.dispute.created`.
- Registered `christlinksocial.com` as a Stripe payment method domain: Apple Pay, Google Pay and Link on the website.
- Checked: Stripe account verified, charges and payouts enabled; live keys on the API, website and EAS production.
- Not done: no host has a Stripe Connect payout account yet (none exist on the platform), so no paid event can sell
  tickets until its host taps Set up payouts. Apple Pay in the iOS app waits on the Apple membership (docs/APP-STORE.md).
- Test: set up payouts as a host, create a $1 event, buy a ticket on christlinksocial.com, refund it; in Stripe →
  Developers → Webhooks both endpoints should show 200s.
