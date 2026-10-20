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
  `npm ci`, and so EAS builds, fail); CI on Node 22; eas.json uses each platform's `default` image for SDK 58 (Xcode 27.1,
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
