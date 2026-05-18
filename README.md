# ChristLink Native

A React Native mobile app for discovering, hosting, and attending faith-based events. Built with Expo, Supabase, and Stripe.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 51 + Expo Router |
| Language | TypeScript (strict) |
| Auth | Supabase OTP (passwordless) |
| Backend | Custom API on Railway |
| Payments | Stripe React Native |
| Styling | NativeWind (Tailwind CSS) |
| Error Monitoring | Sentry |
| Validation | Zod |

## Prerequisites

- Node.js 20+
- npm 9+
- Expo CLI: `npm install -g expo@latest`
- EAS CLI (for builds): `npm install -g eas-cli`
- iOS: Xcode 15+ (Mac only)
- Android: Android Studio / Android SDK

## Setup

### 1. Clone & install

```bash
git clone https://github.com/nolimitdae/christlink-native.git
cd christlink-native
npm install --legacy-peer-deps
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `EXPO_PUBLIC_STRIPE_PK` | Stripe publishable key (`pk_live_` or `pk_test_`) |
| `EXPO_PUBLIC_API_BASE` | Backend API base URL |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN (optional) |

### 3. Start development

```bash
# Expo Go (no native modules)
npm start

# iOS Simulator
npm run ios

# Android Emulator
npm run android
```

## Development Commands

```bash
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run test             # Run unit tests
npm run test:ci          # Run tests with coverage (CI mode)
```

## Building for Production

### First-time EAS setup

```bash
eas login
eas build:configure       # Links to your EAS project
```

Update `app.json` → `extra.eas.projectId` with your EAS project ID.

### Build commands

```bash
# Internal testing build
npm run build:preview

# Production build (App Store / Play Store)
npm run build:production

# Submit to stores
npm run submit:ios
npm run submit:android
```

### Required secrets for production builds

Set these in EAS Secrets (`eas secret:create`) or GitHub Actions secrets:

- `EXPO_TOKEN` — EAS authentication token
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PK`
- `EXPO_PUBLIC_API_BASE`
- `EXPO_PUBLIC_SENTRY_DSN`

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigator screens
│   │   ├── index.tsx      # Home — event discovery
│   │   ├── explore.tsx    # Advanced event search
│   │   ├── host.tsx       # Event creation wizard
│   │   ├── community.tsx  # Community feed
│   │   └── profile.tsx    # User profile
│   ├── event/[id].tsx     # Event detail screen
│   ├── auth.tsx           # OTP authentication
│   └── _layout.tsx        # Root layout (Sentry, Stripe, Auth)
├── components/
│   ├── Avatar.tsx
│   ├── ErrorBoundary.tsx
│   ├── EventCard.tsx
│   ├── GoldButton.tsx
│   ├── LoadingSpinner.tsx
│   └── ScreenHeader.tsx
├── contexts/
│   ├── AuthContext.tsx     # Session management
│   └── ToastContext.tsx    # Toast notifications
├── lib/
│   ├── api.ts             # API client (retry + timeout)
│   ├── constants.ts       # Env-var-based config
│   ├── logger.ts          # Structured logger
│   ├── notifications.ts   # Push notification service
│   ├── supabase.ts        # Supabase client
│   ├── types.ts           # TypeScript interfaces
│   └── validation.ts      # Zod schemas
├── __tests__/             # Unit tests
├── assets/                # Images
├── eas.json               # EAS Build configuration
└── .github/workflows/     # CI/CD pipelines
```

## Authentication Flow

1. User enters email on the auth screen
2. Supabase sends a 6-digit OTP to that email
3. User enters the OTP — session is created
4. Session is stored securely via `expo-secure-store`
5. Auth state changes automatically refresh the profile

## CI/CD

GitHub Actions runs on every push:

1. **Type Check** — `tsc --noEmit`
2. **Lint** — ESLint with TypeScript rules
3. **Unit Tests** — Jest with coverage report
4. **EAS Preview Build** — Builds on pushes to `main`/`master`

Set the required GitHub Actions secrets in your repo settings.

## App Store Submission Checklist

- [ ] Update `app.json` version + `buildNumber` / `versionCode`
- [ ] Replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`
- [ ] Replace placeholder values in `eas.json` submit section
- [ ] Set all EAS secrets
- [ ] Configure Sentry DSN
- [ ] Test on physical device (iOS + Android)
- [ ] Test push notifications on device
- [ ] Verify Stripe payment flow end-to-end
- [ ] Review App Store / Play Store metadata

## License

Private — all rights reserved.
