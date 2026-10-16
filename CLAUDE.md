# Christ Link Social — native app (Expo)

Faith events, tickets, community, prayer, churches and volunteering. This repo is the **iOS/Android app**.
The web app and API live in `NolimitDae/ChristLink1` (server.js on Railway, public/index.html).

## Stack
- Expo SDK 51, expo-router v3 (file routes in `app/`), React Native 0.74, TypeScript strict
- Data: Railway REST API (`lib/api.ts`) for events, tickets, payments, community, profiles, admin.
  Supabase directly (`lib/features.ts`, user JWT + RLS) for churches, prayers, verses, serve, reports,
  blocks, settings, push tokens. Schema: `supabase/migrations/`.
- Auth: Supabase email one-time code. Session in Keychain/Keystore (`lib/supabase.ts` chunked SecureStore).
- Payments: Stripe PaymentSheet (Apple Pay / Google Pay) + Stripe Connect Express. See docs/PAYMENTS.md.
- Push: Expo push tokens → `push_tokens`; `supabase/functions/push-dispatch` sends on `notifications` insert.
  Event/serve reminders are local scheduled notifications (`lib/notifications.ts`).
- Monitoring: Sentry (`EXPO_PUBLIC_SENTRY_DSN`).

## Run locally
1. `npm install --legacy-peer-deps`
2. `cp .env.example .env.local` and fill it (use `pk_test_` Stripe keys; never paste keys into chat).
3. `npx expo start` → scan the QR with Expo Go (Stripe, maps, camera and push all work in Expo Go except
   Apple Pay and remote push, which need a dev build: `eas build --profile development`).
4. Checks before every commit: `npm run typecheck && npm run lint && npm test`.

## Deploys
- Railway deploys the API from ChristLink1 `main` automatically — untested merges go live.
- This app ships through EAS: `eas build --profile preview` (internal testers), `--profile production` + `eas submit`.
- Database changes: add a new file in `supabase/migrations/`, apply to a **development** project first,
  then production. Never edit an applied migration.

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
- Supabase feature calls throw `FeatureError`; `notSetUp` means the migration isn't applied → show an EmptyState.

## Design rules (docs/DESIGN.pdf)
- Use the design system only: `useTheme()` tokens (`t.c.*`, `t.type`, `t.space`, `t.radius`), components in
  `components/ui`. No hardcoded colors outside brand art. Preview everything at `/styleguide`.
- Warm black + ivory, gold sparingly. Gold text uses `t.c.goldText` (darker gold on light). Gold buttons use dark text.
- Serif (DM Serif Display) for titles, Montserrat for text (Loew Next needs a license; swap in `lib/theme.ts`).
- No bare spinners for loading screens — skeletons. Every empty state: line illustration + one action.
- Respect Reduce Motion (`t.reduceMotion`) and Dynamic Type; 44pt touch targets; accessibility labels on custom controls.
- The tab bar floats: scrollable tab screens need ≥ 120pt bottom padding.

## Store compliance (keep working)
- In-app account deletion (Settings → Delete account → `delete_my_account()`), keeps ticket/payment records.
- Report + block on posts, replies, forum messages, prayers, profiles, events, churches; admin queue in `/admin`.
- Terms + privacy checkbox at sign-in records `TERMS_VERSION`; hosts confirm 18+ before paid events.
- Permission prompts explain why (camera = check-in, location = nearby, notifications = reminders).

## Known gaps / don't break
- Wallet pass needs a server signed-URL endpoint (docs/PAYMENTS.md). Payout history is in the Stripe dashboard.
- Website must serve `.well-known` files and redirect `/event/:id` → `/#event/:id` (docs/deeplinks/README.md).
- `GET /api/price-breakdown?price=0` returns negative host earnings (server bug, documented).

## Docs
docs/STATUS.md (feature status) · docs/PROGRESS.md (session log) · docs/PAYMENTS.md · docs/SECURITY.md ·
docs/REVIEW.md (developer review packet) · docs/STORE.md (listings + launch checklist) · docs/deeplinks/

## End of every session
Answer "Summarize what you changed, what you didn't finish, and anything I should test" in docs/PROGRESS.md.
If the same bug fails three fixes, stop and add it to docs/REVIEW.md for the paid developer review.
