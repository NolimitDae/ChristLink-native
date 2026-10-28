# Christ Link Social — native app (Expo)

Faith events, tickets, community, prayer, churches and volunteering. This repo holds the **iOS/Android app**
and its **backend** (`backend/`, NestJS on Railway). The website still lives in `NolimitDae/ChristLink1`
(server.js + Supabase) until the planned switch in docs/LAUNCH.pdf; **no new features go into server.js or Supabase.**

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

## Run locally
1. `npm install` (`.npmrc` sets legacy-peer-deps)
2. `cp .env.example .env.local` and fill it (use `pk_test_` Stripe keys; never paste keys into chat).
3. `npx expo start` → scan the QR with Expo Go (the App Store Expo Go runs only the newest SDK). Apple Pay and
   remote push need a dev build: `eas build --profile development`.
4. Checks before every commit: `npm run typecheck && npm run lint && npm test`.
5. Backend: `cd backend && docker compose up -d && npm run start:dev`; checks before every commit:
   `npm run typecheck && npm test && npm run test:e2e` (backend/README.md).

## Deploys
- Railway production (project "ChristLink") deploys `backend/` from this repo's `master`, and the old API from
  ChristLink1 `main`, automatically — untested merges go live. Staging follows `claude/railway-launch`.
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
- Serif (DM Serif Display) for titles, Montserrat for text (Loew Next needs a license; swap in `lib/theme.ts`).
- No bare spinners for loading screens — skeletons. Every empty state: line illustration + one action.
- Respect Reduce Motion (`t.reduceMotion`) and Dynamic Type; 44pt touch targets; accessibility labels on custom controls.
- The tab bar floats: scrollable tab screens need ≥ 120pt bottom padding.

## Store compliance (keep working)
- In-app account deletion (Settings → Delete account → `DELETE /api/account`), keeps ticket/payment records.
- Report + block on posts, replies, forum messages, prayers, profiles, events, churches; admin queue in `/admin`.
- Terms + privacy checkbox at sign-in records `TERMS_VERSION`; hosts confirm 18+ before paid events.
- Permission prompts explain why (camera = check-in, location = nearby, notifications = reminders).

## Known gaps / don't break
- Payout history is in the Stripe dashboard. Apple Wallet needs the APPLE_PASS_* certificate variables in Railway.
- Website must serve `.well-known` files and redirect `/event/:id` → `/#event/:id` (docs/deeplinks/README.md).
- The old server.js still returns negative host earnings for `price=0`; the new backend fixes it.

## Docs
docs/LAUNCH.pdf (plan) · docs/BACKEND.md · docs/BUILDS.md (EAS builds + updates) · docs/STATUS.md (feature status) · docs/PROGRESS.md (session log) · docs/PAYMENTS.md · docs/SECURITY.md ·
docs/REVIEW.md (developer review packet) · docs/STORE.md (listings + launch checklist) · docs/deeplinks/

## End of every session
Answer "Summarize what you changed, what you didn't finish, and anything I should test" in docs/PROGRESS.md.
If the same bug fails three fixes, stop and add it to docs/REVIEW.md for the paid developer review.
