# Builds and over-the-air updates

EAS project: `@nolimittechs-organization/christlink` (id `d64de815-22a9-48e7-8e89-f1da181fab6a`).
Expo SDK 51. Runtime version follows `version` in app.json (`1.0.0`), so updates only reach builds of that version.

| Profile | Installs as | EAS environment | Update channel |
| --- | --- | --- | --- |
| development | dev client (needs `npx expo start`) | development | development |
| preview | standalone app from a link / QR (Android APK, iOS ad hoc) | development | preview |
| production | store build (Android AAB, iOS) | production | production |

## Environment variables (expo.dev → project → Environment variables)

| Variable | development | production | Notes |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_BASE` | `https://christlink1-production.up.railway.app` | same | ChristLink1 (server.js) on Railway |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://iqosvigdelnmarecpkkp.supabase.co` | same | set 2026-10-24 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ChristLink project anon key | same | set 2026-10-24 (public by design) |
| `EXPO_PUBLIC_STRIPE_PK` | `pk_test_…` | `pk_live_…` at launch | without it paid checkout is off |
| `EXPO_PUBLIC_SENTRY_DSN` | optional | optional | crash reporting |
| `EXPO_PUBLIC_STRIPE_MERCHANT_ID` | optional | optional | defaults to `merchant.com.christlinksocial.app` |

`EXPO_PUBLIC_*` values are compiled into the app, so they must be plain text and must never be secret keys.
An EAS build stops early (app.config.js) if the API base or either Supabase value is missing.

## First build (on your computer, in the repo root)

```sh
npm i -g eas-cli
eas login
npm install --legacy-peer-deps
eas build --profile preview --platform android   # gives an APK link + QR code
eas device:create                                # iPhone only: open the link it prints on the phone
eas build --profile preview --platform ios       # first run asks for your Apple Developer sign-in
```

No `eas init` needed: the project id is already in app.json. Open the build page on expo.dev on the phone, or scan
its QR code, and install.

## Updates after that

```sh
eas update --channel preview --environment development --message "what changed"
```

Close and reopen the app twice to pick it up. Rebuild instead when you add a native package, change a plugin or
permission in app.json, or bump `version`.

## Cloud sessions

Builds and updates from a Claude cloud session need an `EXPO_TOKEN` secret on that environment
(expo.dev → Account settings → Access tokens).
