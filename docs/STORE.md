# App Store & Google Play — listings and launch checklist

**iOS:** everything App Store Connect asks for (listing copy, privacy labels, age rating, review account and notes,
the steps once the Apple Developer membership is active, and the risks to settle before submitting) is in
**docs/APP-STORE.md**. This page covers Google Play and the shared launch checklist.

## Google Play listing

- **Name:** Christ Link Social
- **Short description (80):** Find faith events near you, get tickets, pray together and serve your church.
- **Full description:** the iOS description in docs/APP-STORE.md, with "Apple Pay" → "Google Pay".
- **Category:** Lifestyle. **Tags:** Events, Social. **Target audience:** 13+.
- **Content rating questionnaire:** users can interact and share content: Yes (reporting, blocking, moderation);
  no violence, sexual content, gambling or drugs. Digital purchases: No (tickets are for in-person events).
- **App access:** sign-in required → the same review account as iOS (`appreview@christlinksocial.com` + the
  `REVIEW_CODE` from Railway → ChristLink-API), with the steps from the App Review notes.
- **Screenshots:** Play accepts the 1320×2868 images in `store/screenshots/iphone-6.9/` (ratio within 2:1 limits).
  Feature graphic 1024×500: still to make.

## Google Play Data safety

Collected (all sent only to processors acting for us, so not "shared" under Play's definition): name, email,
user IDs, photos, government ID photo (hosts, for fraud prevention), purchase history, messages/posts/prayers,
approximate and precise location (only to answer "Near me", not stored). Payment details are collected by Stripe.
Crash logs only if `EXPO_PUBLIC_SENTRY_DSN` is set. Encrypted in transit: Yes. Deletion: Yes (Settings → Delete
account, or email support). Processors: Railway (API and database), Cloudflare (files), Stripe, Resend (email),
Expo (push), Sentry (crashes, if enabled).

## Play Console steps

1. Create the app (package `com.christlink.app`), fill the listing, Data safety, content rating and App access above.
2. `eas build --platform android --profile production`, then upload to **Internal testing** (first upload by hand;
   later `eas submit -p android` with a Google service account key).
3. Copy **App signing key certificate SHA-256** (Setup → App integrity) into the website's `ANDROID_SHA256_FINGERPRINTS` variable
   on Railway → ChristLink-Web so christlinksocial.com links open the app (`/.well-known/assetlinks.json`).
4. Google Maps Android key → `GOOGLE_MAPS_API_KEY` in the EAS production environment (the map tab needs it).

## Shared launch checklist (in order)

1. **Backend (Railway production):** live Stripe keys and webhook secret on ChristLink-API; database backups on;
   `prisma migrate deploy` ran on the latest deploy (it runs before each one).
2. **EAS production environment:** `EXPO_PUBLIC_API_BASE` and `EXPO_PUBLIC_STRIPE_PK` (`pk_live_…`) are set; optional
   `EXPO_PUBLIC_SENTRY_DSN`. docs/BUILDS.md.
3. **Content:** a few real upcoming events and Prayer Wall posts in production, so reviewers don't see empty lists.
4. **Legal:** privacy policy and terms reviewed, then clear `LEGAL_DRAFT_NOTICE` in content/legal.ts.
5. Build both platforms (`eas build --profile production --platform all`), submit to TestFlight and Play internal
   testing.
6. On your own phone: buy a **$1 real ticket** to your own test event with Apple Pay / Google Pay, check it in with
   the scanner, refund it from Sales; confirm the refund lands in Stripe and the ticket shows Refunded.
7. Admin → Tools: send yourself a test push; confirm an event reminder arrives.
8. Submit for review. Someone watches Admin → Reports daily (reports must be handled within 24 hours).
