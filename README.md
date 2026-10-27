# Christ Link Social — iOS & Android

Find faith events near you, RSVP or buy tickets, pray together, find your Home Church and serve.
Built with Expo (React Native) on top of the Christ Link Social API (Railway) and Supabase.

| Layer | Technology |
|---|---|
| App | Expo SDK 51, expo-router, React Native 0.74, TypeScript strict |
| Design | Custom design system (`lib/theme.ts`, `components/ui`), DM Serif Display + Montserrat, light/dark |
| Auth | Supabase email + password (same accounts as the website) or email one-time code, session in Keychain/Keystore |
| Data | Railway REST API (`lib/api.ts`) + Supabase tables/RPCs with RLS (`lib/features.ts`) |
| Payments | Stripe PaymentSheet (Apple Pay, Google Pay), Stripe Connect Express payouts |
| Native | Camera check-in, maps with clustering, haptics, share cards, local reminders, push |
| Monitoring | Sentry |

## Quick start (test on your phone)

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in values — use a pk_test_ Stripe key
npx expo start               # scan the QR code with Expo Go (iOS Camera app / Android Expo Go)
```

Expo Go supports everything except Apple Pay and remote push. For those, build a development client once:
`npx eas-cli init` (sets the EAS project id), then `eas build --profile development --platform ios`.

## Turn on the new features (one-time database step)

Churches, Prayer Wall, verse of the day, Serve, reports/blocks, settings, push tokens and account deletion use
`supabase/migrations/20261015000000_native_features.sql`. Until it's applied those screens show a friendly
"coming soon" state; everything else works.

1. Apply it to a **development** Supabase project first (`supabase db push` or paste into the SQL editor), then
   optionally run `supabase/seed.sql` for sample churches, prayers and volunteer shifts.
2. Test with two accounts (docs/SECURITY.md has the checklist), then apply to production.
3. Push: `supabase functions deploy push-dispatch`, set the `PUSH_WEBHOOK_SECRET` secret, and add a Database Webhook
   on `notifications` INSERT that calls it with header `x-webhook-secret`.

## Environment variables

| Variable | Where | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | .env.local, EAS secrets | Public anon key only |
| `EXPO_PUBLIC_API_BASE` | .env.local, EAS secrets | `https://christlink1-production.up.railway.app` |
| `EXPO_PUBLIC_STRIPE_PK` | .env.local, EAS secrets | `pk_test_…` until launch |
| `EXPO_PUBLIC_STRIPE_MERCHANT_ID` | optional | Apple Pay merchant id |
| `EXPO_PUBLIC_SENTRY_DSN` | optional | Crash reports |
| `GOOGLE_MAPS_API_KEY` | EAS secret | Android maps in store builds |

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server (Expo Go / dev client) |
| `npm run typecheck` · `npm run lint` · `npm test` | Checks run in CI on every push |
| `npm run test:ci` | Tests + coverage gate (logic modules ≥ 80% lines) |
| `npm run build:preview` | Internal test builds (APK + iOS ad-hoc) |
| `npm run build:production` → `npm run submit:ios` / `submit:android` | Store builds (TestFlight / Play internal) |

## Project layout

```
app/                 expo-router screens
  (tabs)/            Home · Explore · Host · Community · Tickets
  event/[id]/        detail, forum, sales      event/create  (4-step builder)
  ticket/[id]        QR ticket                 host/         payouts, verify, scan, serve
  church/            church page + edit        serve/        my shifts
  profile, user/[id], settings/, notifications, onboarding, auth, legal/[doc], admin, styleguide
components/ui/       design system             components/<area>/  screen components
contexts/            Auth, Theme, AppData (saved, blocks, settings, online), Toast
lib/                 api, features, fees, format, qr, recurrence, clusters, notifications, theme …
supabase/            migrations, seed.sql, functions/push-dispatch
docs/                STATUS, PAYMENTS, SECURITY, STORE, REVIEW, PROGRESS, deeplinks
```

Open `/styleguide` in the app (e.g. `npx uri-scheme open christlink://styleguide --ios`) to see every component
in light and dark mode.

## Docs
- docs/STATUS.md — every feature in the build plan with status
- docs/PAYMENTS.md — how money moves, fee math, refunds, payouts
- docs/SECURITY.md — RLS, account deletion, backend issues found
- docs/STORE.md — listings, screenshots, privacy labels, launch checklist
- docs/REVIEW.md — packet for the paid developer review
- CLAUDE.md — rules for future Claude Code sessions
