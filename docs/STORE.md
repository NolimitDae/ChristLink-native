# App Store & Google Play — listings, privacy answers and launch checklist

## Listing copy

**Name:** Christ Link Social
**Subtitle (iOS, 30 chars):** Faith events & community
**Short description (Play, 80 chars):** Find faith events near you, get tickets, pray together and serve your church.
**Keywords (iOS, 100 chars):** church,events,worship,bible study,prayer,christian,youth group,volunteer,tickets,ministry

**Description:**
Christ Link Social helps you find your people and grow your faith — in person.

• Discover worship nights, Bible studies, retreats, concerts and youth events near you, on a map or by category.
• See which friends are going and invite others in a tap.
• RSVP free or buy tickets with Apple Pay or Google Pay. Your QR ticket works offline.
• Pray with your community on the Prayer Wall — and celebrate answered prayers.
• Find your Home Church: service times, recurring gatherings and upcoming events in one place.
• Serve: sign up for volunteer shifts in two taps and track the hours you've served.
• Verse of the day, beautiful share cards for Stories, and a warm, focused design in light and dark mode.

For hosts and churches: create events with live preview, sell tickets with Stripe payouts, check guests in with
your camera, manage volunteers and see your sales at a glance.

**Category:** Lifestyle (primary), Social Networking (secondary). **Age rating:** 12+ (user-generated content,
moderated; no mature themes). Answer "Yes" to user-generated content with reporting/blocking.

## Six screenshots (6.7" and 6.1" iPhone; Play phone)
1. Home — greeting, verse of the day, "Happening tonight" carousel. Caption: "Faith events, happening near you."
2. Event detail with friends going and sticky RSVP bar. Caption: "See who's going. Join in one tap."
3. RSVP light-burst moment / ticket landing in Tickets. Caption: "Tickets that feel like a moment."
4. Prayer Wall with "I prayed" glow and an Answered ribbon. Caption: "Pray together. Celebrate answers."
5. Church page with service times and recurring Bible study. Caption: "Find your Home Church."
6. Host dashboard with sales sparkline + scanner. Caption: "Host, sell and check in — all in one app."
Use the demo account below with seeded data; take them in dark mode except #4 (light) to show both.

## Demo account for reviewers
Create `review@christlinksocial.com` with a password in the app (Sign in → Create account), mark the profile
`identity_verified = true` and give it one hosted free event, one paid test event and one RSVP. Put the
email and password in App Review notes.

## App Store privacy labels ("Data linked to you")
| Data type | Collected | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Name, email | Yes | App functionality, account | Yes | No |
| Photos (avatar, banner, event images) | Yes | App functionality | Yes | No |
| Government ID image (hosts only) | Yes (Sensitive info) | Fraud prevention | Yes | No |
| Precise location | Only when using Near me / map; not stored | App functionality | No | No |
| Purchases (ticket history) | Yes | App functionality | Yes | No |
| Payment info | Handled by Stripe, not collected by us | — | — | — |
| User content (posts, prayers, messages) | Yes | App functionality | Yes | No |
| Device ID (push token) | Yes | App functionality | Yes | No |
| Crash data, performance | Yes (Sentry) | App functionality | No | No |
No data is used for tracking or third-party advertising.

## Google Play Data safety
Collected & shared only with processors (not "shared" under Play's definition): name, email, user IDs, photos,
government ID (hosts), approximate & precise location (ephemeral), purchase history, messages/posts, crash logs,
device or other IDs. Encrypted in transit: Yes. Users can request deletion: Yes (in-app, Settings → Delete account,
and support email). Processors: Supabase, Railway, Stripe, Sentry, Expo, email provider.

## What you must do yourself
**App Store Connect:** create the app (bundle `com.christlink.app`), fill privacy labels above, age rating,
App Review notes + demo account, support URL and privacy policy URL (`https://christlinksocial.com/legal/privacy`
once the web serves the legal pages), Sign in with Apple is **not** required (no third-party login), enable
Apple Pay merchant ID `merchant.com.christlinksocial.app` and upload the Stripe Apple Pay certificate, Associated
Domains capability (EAS sets it from app.json), export compliance "No" (set in app.json).
**Play Console:** create app, Data safety form, content rating questionnaire (UGC: yes), target audience 13+,
App access (demo account), upload `google-service-account.json` for `eas submit`, copy the App signing SHA-256 into
`docs/deeplinks/assetlinks.json`, internal testing track first.
**Accounts:** `eas init` (writes `extra.eas.projectId` in app.json — required for remote push), Google Maps
Android key → `GOOGLE_MAPS_API_KEY` EAS secret, Sentry DSN → `EXPO_PUBLIC_SENTRY_DSN` EAS secret.

## Production launch checklist (in order)
1. Supabase: confirm daily backups + point-in-time recovery are on; apply the migration to production after
   testing it on a dev project; run the SECURITY.md SQL checks with two accounts.
2. Deploy `push-dispatch` (`supabase functions deploy push-dispatch`), set `PUSH_WEBHOOK_SECRET`, create the
   Database Webhook on `notifications` INSERT; optional: enable `pg_cron` for daily prayer summaries.
3. Railway: switch to live Stripe keys (`sk_live_`), live webhook endpoint + signing secret; confirm rate limits on
   sign-in, uploads, `/api/create-payment-intent`, `/api/charge-listing-fee`.
4. EAS secrets: `EXPO_PUBLIC_STRIPE_PK=pk_live_…`, Sentry DSN, Maps key. Bump `version` in app.json.
5. Website: serve `.well-known` files and `/event/:id` redirect (docs/deeplinks/README.md); legal pages live.
6. `eas build --profile production --platform all` → `eas submit` → TestFlight + Play internal testing.
7. On your own phone: buy a **$1 real ticket** to your own test event with Apple Pay, check it in with the scanner,
   then refund it from the Sales screen; confirm the refund lands in Stripe and the ticket shows Refunded.
8. Send yourself a test push from Admin → Tools; confirm an event reminder arrives.
9. Submit for review; post launch announcements with share cards from the app.
