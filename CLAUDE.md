# Christ Link Social — native app (Expo)

Faith events, tickets, community, prayer, churches and volunteering. This repo holds the **iOS/Android app**,
its **backend** (`backend/`, NestJS on Railway) and, since 2026-11-07, the **website**: christlinksocial.com is this
app's web build (`web/server.mjs`, Railway service ChristLink-Web; docs/CUTOVER.md). The old site
(`NolimitDae/ChristLink1`, server.js + Supabase) is off the domain and kept only for rollback; **nothing new goes there.**

## Stack
- App: Expo SDK 58, expo-router (file routes in `app/`), React Native 0.88, React 19, New Architecture,
  Reanimated 4, TypeScript strict.
- Backend: `backend/` NestJS + Prisma + Postgres + Redis (BullMQ worker = same image with `ROLE=worker`),
  files on Cloudflare R2. Architecture and API contract: docs/BACKEND.md. Staging: Railway project
  "ChristLink Staging" → https://christlink-api-staging.up.railway.app (deploys branch `claude/railway-launch`).
- Data: everything goes through the API — `lib/api.ts` (events, tickets, payments, community, profiles, admin)
  and `lib/features.ts` (churches, prayers, verses, serve, reports, blocks, settings, push tokens).
- Auth: email one-time code from the API (`/api/auth/*`); JWT access + rotating refresh token in
  Keychain/Keystore (`lib/session.ts`).
- Payments: Stripe PaymentSheet (Apple Pay / Google Pay) + Stripe Connect Express. See docs/PAYMENTS.md.
- Push: Expo push tokens → `push_tokens`; the backend worker pushes every new `notifications` row.
  Event/serve reminders are local scheduled notifications (`lib/notifications.ts`).
- Monitoring: Sentry (`EXPO_PUBLIC_SENTRY_DSN`).
- Website: the same app exported for the browser (`npm run web:build`). Native-only packages map to `web/shims/` on web
  (metro.config.js): Stripe.js payments, localStorage sessions, browser date/time inputs, no-op notifications, no map.
  Keep new native-only modules web-safe (add a shim or a `Platform.OS === 'web'` path) and run `npm run test:web`.

## Run locally
1. `npm install` (`.npmrc` sets legacy-peer-deps)
2. `cp .env.example .env.local` and fill it (use `pk_test_` Stripe keys; never paste keys into chat).
3. `npx expo start` → scan the QR with Expo Go (the App Store Expo Go runs only the newest SDK). Apple Pay and
   remote push need a dev build: `eas build --profile development`.
4. Checks before every commit: `npm run typecheck && npm run lint && npm test`.
5. Backend: `cd backend && docker compose up -d && npm run start:dev`; checks before every commit:
   `npm run typecheck && npm test && npm run test:e2e` (backend/README.md).

## Deploys
- Railway production (project "ChristLink") deploys the API, worker and website (ChristLink-Web) from this repo's
  `master` — untested merges go live, including christlinksocial.com. Staging follows `claude/railway-launch`.
- This app ships through EAS: `eas build --profile preview` (internal testers), `--profile production` + `eas submit`.
- Preview builds read the **development** EAS environment (API = staging); production builds read **production**.
  Public config (`EXPO_PUBLIC_*`) lives in EAS environment variables, not in `eas.json` or the repo: docs/BUILDS.md.
- JS-only fixes go over the air: `eas update --channel preview --environment development --message "..."`.
  A new native module or a new `version` in app.json needs a new build (runtime version = app version).
- Database changes: add a new Prisma migration in `backend/prisma/migrations/` (`prisma migrate deploy` runs before
  each deploy; staging first). Never edit an applied migration. `supabase/` is the frozen old schema.

## Branch rule
Never commit directly to `main`. Work on a branch, open a PR, test on a phone, then merge.

## Architecture rules
- Screens never call `fetch` directly; add a typed function in `lib/api.ts` (with a row in
  `__tests__/lib/api-contract.test.ts`) or `lib/features.ts`.
- The API returns web field names; normalize them in `lib/api.ts` only (`body`→`content`, `author_id`→`user_id`,
  `host_avatar`→`host_avatar_url`, `confirmed_rsvps`→`going_count`, `ticket_types[].sold`→`tickets_sold`).
- Avatar colors from the web can be CSS gradients; always render through `components/Avatar.tsx` / `lib/color.ts`.
- Money is integer cents everywhere. Fee math lives in `lib/fees.ts` and must match the server (tests pin it).
- Payment and other non-idempotent requests are never auto-retried (`apiFetch` retries GETs only).
- After a successful PaymentSheet payment, always call `confirmTicketByIntent` (confirm-by-intent fallback); the
  webhook stays the source of truth.
- Ticket QR payload must stay identical to the web app: `{"ticketId","eventId","code","status"}` (`lib/qr.ts`).
- `lib/features.ts` calls throw `FeatureError`; `notSetUp` means the route isn't deployed → show an EmptyState.
- The backend keeps server.js response shapes (docs/BACKEND.md rule 1). `backend/test/contract.e2e-spec.ts` fails
  when a route listed in `__tests__/lib/api-contract.test.ts` is missing from the backend.

## Design rules (docs/DESIGN.pdf)
- Use the design system only: `useTheme()` tokens (`t.c.*`, `t.type`, `t.space`, `t.radius`), components in
  `components/ui`. No hardcoded colors outside brand art. Preview everything at `/styleguide`.
- Warm black + ivory, gold sparingly. Gold text uses `t.c.goldText` (darker gold on light). Gold buttons use dark text.
- Not template-looking: no decorative rules after section titles; sentence-case `label` text for card/section labels
  (all-caps `overline` only for event-type kickers, calendar months, ticket stubs, badges, settings groups); plain line
  icons in rows and tiles (no tinted icon squares); no sparkle icons, no arrows on buttons; text at least 4.5:1.
- Logo: `components/brand/Logo.tsx` (`Logo` horizontal/stacked, `LogoMark`); never redraw it. Masters in assets/brand,
  icons/splash/favicon/web/email images generated by `node scripts/brand/build-brand.mjs` (one gold: `t.c.gold`). Use it
  on brand moments only (welcome, sign-in, share cards, settings footer), not in navigation bars.
- Newsreader (serif) for titles and verses, Instrument Sans for text and UI (`lib/theme.ts`). Avoid default/"AI" faces
  (Inter, Roboto, Montserrat, Geist, Space Grotesk, Satoshi). Loew Next needs a license; swap the text face in `lib/theme.ts`.
- No bare spinners for loading screens — skeletons. Every empty state: line illustration + one action.
- Respect Reduce Motion (`t.reduceMotion`) and Dynamic Type; 44pt touch targets; accessibility labels on custom controls.
- Motion: springs from `lib/motion.ts` (`SPRING.*`: damping ratio + response, critically damped by default; bounce only
  after a flick). Tappable cards/chips/buttons use `components/ui/PressScale` (feedback on touch-down); content that
  replaces a skeleton uses `Appear`; drags track 1:1, rubber-band at edges and hand their velocity to the spring.
- Icons: one concept = one icon (docs/ICONS.md). Prayer/Amen = praying hands, church, serve and Bible use `AppIcon`
  custom glyphs; everything else Ionicons outline, filled only when active.
- The tab bar floats (Discover, Events, Tickets, Community, Profile; Host is a hidden tab reached from Profile).
  Tab screens pad their scroll content and floating buttons with `useTabBarClearance()` from components/TabBar.tsx.
- Apple HIG basics: type sizes follow the HIG Large ramp in `lib/theme.ts` (body 17, callout 15, caption 12, display 34).
  Top-level scroll screens use `useCollapsingTitle` + `LargeTitle` + `CompactTitleBar` (components/ui/LargeTitle.tsx):
  the bar's hairline shows only while content is under it, tapping it scrolls to top, and the same scroll handler
  minimizes the tab bar (`lib/tabBarMotion.ts`). Tabs with pinned controls (Events, Community) use `CollapsingHeader`
  (components/ui/CollapsingHeader.tsx); bottom-pinned buttons inside it apply `useFloatingOffset()`. Nested corners are concentric: `concentric(outer, inset)` from
  `lib/theme.ts`. Haptics mark outcomes (success/error) and value changes (selection), never plain navigation:
  `Button` and `IconButton` stay silent by default. Rows in a sheet are menu items (no chevron). Event cards open
  `openEventActions` on long press (components/EventQuickActions.tsx).

## Store compliance (keep working)
- In-app account deletion (Settings → Delete account → `DELETE /api/account`), keeps ticket/payment records.
- Report + block on posts, replies, forum messages, prayers, profiles, events, churches; admin queue in `/admin`.
- Terms + privacy checkbox at sign-in records `TERMS_VERSION`; hosts confirm 18+ before paid events.
- Permission prompts explain why (camera = check-in, location = nearby, notifications = reminders).

## Known gaps / don't break
- Payout history is in the Stripe dashboard. Apple Wallet needs the APPLE_PASS_* certificate variables in Railway.
- The website serves `.well-known` app-link files from env (`web/server.mjs`); old `#event/<id>` links are redirected
  in the app (`lib/legacyLinks.ts`). Uploads need `R2_PUBLIC_URL` (docs/CUTOVER.md status).
- The old server.js still returns negative host earnings for `price=0`; the new backend fixes it.

## Docs
docs/LAUNCH.pdf (plan) · docs/CUTOVER.md (website switch, keeping accounts) · docs/BACKEND.md · docs/BUILDS.md (EAS builds + updates) · docs/ICONS.md · docs/STATUS.md (feature status) · docs/PROGRESS.md (session log) · docs/PAYMENTS.md · docs/SECURITY.md ·
docs/REVIEW.md (developer review packet) · docs/STORE.md (listings + launch checklist) · docs/WEB-PREVIEW.md (browser preview with sample data) · docs/deeplinks/

## End of every session
Answer "Summarize what you changed, what you didn't finish, and anything I should test" in docs/PROGRESS.md.
If the same bug fails three fixes, stop and add it to docs/REVIEW.md for the paid developer review.
