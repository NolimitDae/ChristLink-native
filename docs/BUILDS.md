# Builds and over-the-air updates

EAS project: `@nolimittechs-organization/christlink` (id `d64de815-22a9-48e7-8e89-f1da181fab6a`). Expo SDK 58.
Runtime version is a **fingerprint** of the native project (packages, plugins, app.json native settings), so an
update only reaches builds whose native side is identical. After a native change (package upgrade, plugin, permission)
older builds stop getting updates until rebuilt. Since 2026-11-12; builds made before that use runtime `1.0.0`.

| Profile | Installs as | EAS environment | API | Update channel |
| --- | --- | --- | --- | --- |
| development | dev client (needs `npx expo start`) | development | Railway staging | development |
| preview | standalone app from a link / QR (Android APK, iOS ad hoc) | development | Railway staging | preview |
| production | store build (Android AAB, iOS) | production | Railway production | production |

## Environment variables (expo.dev → project → Environment variables)

| Variable | development | production | Notes |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_BASE` | `https://christlink-api-staging.up.railway.app` | `https://christlink-api-production.up.railway.app` | set 2026-10-28 |
| `EXPO_PUBLIC_STRIPE_PK` | `pk_test_…` | `pk_live_…` (set 2026-11-12) | without it paid checkout is off |
| `EXPO_PUBLIC_SENTRY_DSN` | optional | optional | crash reporting |
| `EXPO_PUBLIC_STRIPE_MERCHANT_ID` | optional | optional | defaults to `merchant.com.christlinksocial.app` |

`EXPO_PUBLIC_*` values are compiled into the app, so they must be plain text and never secret keys. An EAS build
stops early (app.config.js) if `EXPO_PUBLIC_API_BASE` is missing. Backend secrets (Resend, Stripe secret, R2, JWT)
live in Railway variables, never here.

## First build (on your computer, in the repo root)

```sh
npm i -g eas-cli
eas login
npm install
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

Close and reopen the app twice to pick it up. Rebuild instead when you add or upgrade a native package, change a
plugin or permission in app.json, or bump `version` (`npx expo-updates runtimeversion:resolve --platform ios` shows the current one).

Store release: docs/APP-STORE.md (iOS) and docs/STORE.md (Google Play).

Expo Go (App Store) only runs the newest SDK: `EXPO_GO_UPDATE=1 eas update --branch expo-go --environment development`.

## Cloud sessions

Builds and updates from a Claude cloud session need an `EXPO_TOKEN` secret on that environment
(expo.dev → Account settings → Access tokens).
