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
