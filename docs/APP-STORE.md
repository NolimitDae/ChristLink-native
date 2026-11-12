# App Store submission sheet (iOS)

Everything App Store Connect asks for, ready to paste, plus the order of steps. Google Play: docs/STORE.md.

## Status (2026-11-12)

Ready in the repo and in production:
- **App config**: bundle `com.christlink.app`, version 1.0.0, Expo SDK 58 packages at the SDK's expected versions,
  privacy manifest (required-reason APIs declared, no tracking), only the permissions the app uses, each with a
  specific purpose string (camera, photos, save to photos, location while in use, calendar write-only). Face ID,
  "Always" location, motion, microphone and Reminders prompts removed; dev-client local-network keys stripped from
  store builds (`plugins/withAppStoreRelease.js`); push set to production; export compliance "no encryption beyond
  HTTPS" (`ITSAppUsesNonExemptEncryption = false`). Checked by generating the iOS project (`expo prebuild`).
- **Icon** 1024×1024, no transparency. **Screenshots**: `store/screenshots/iphone-6.9/` (6 × 1320×2868, the size
  App Store Connect requires; smaller iPhones are scaled from it). iPad not needed (`supportsTablet: false`).
- **Production** (christlinksocial.com + Railway): privacy policy, terms and a Support page are live; sign-in emails
  work; the App Review account below works; EAS production builds get the API address and the live Stripe key.

**Blocked on Apple**: the App Store Connect API key in this project belongs to team `QKP52JF8KD`, and Apple answers
"Unable to find a team with the given Team ID … to which you belong" for anything in Certificates, Identifiers &
Profiles, and lists no apps. That means the **Apple Developer Program membership is not active yet** (or the key
belongs to an account that isn't a member of that team). Check https://developer.apple.com/account → Membership.
Until it is active nothing can be signed, so there is no store build yet.

## Once the membership is active

1. **Merchant ID for Apple Pay** (Certificates, Identifiers & Profiles → Identifiers → Merchant IDs):
   `merchant.com.christlinksocial.app`. Then Stripe Dashboard → Settings → Payment methods → Apple Pay → iOS
   certificate: download Stripe's CSR, create the Apple Pay Payment Processing certificate for that merchant ID with
   it, upload the certificate back to Stripe. (Without this, cards still work; the Apple Pay button doesn't appear.)
2. **Create the app** in App Store Connect → Apps → + → New App: iOS, name **Christ Link Social**, primary language
   English (U.S.), bundle ID **com.christlink.app** (EAS registers it on the first build if it isn't listed yet),
   SKU `christlink-ios`, full access. Apple's API can't create apps, so this one step is in the website.
3. Copy the app's **Apple ID** (App Information → General) into `eas.json` → `submit.production.ios.ascAppId`.
4. Build and upload (the ASC API key env vars `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID` and the key file let EAS make
   the distribution certificate and provisioning profile, with Push, Associated Domains and Apple Pay):
   ```sh
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```
5. In TestFlight, install it on your phone and run the checks at the end of this page. Then fill in the fields
   below and **Submit for Review**.

## App Information

| Field | Value |
| --- | --- |
| Name | Christ Link Social |
| Subtitle (30) | Faith events & community |
| Primary category | Lifestyle |
| Secondary category | Social Networking |
| Content rights | Yes, it contains third-party content (photos and posts members upload); you have the rights through the Terms of Service |
| Age rating | Answer: user-generated content **Yes** (with reporting, blocking and moderation), messaging/chat between users **Yes** (event chat, replies), unrestricted web access **No**, all violence/sexual/drugs/gambling/horror questions **None**. Expected rating: 13+ |
| Price | Free (no in-app purchases) |
| Privacy Policy URL | https://christlinksocial.com/legal/privacy |
| Support URL | https://christlinksocial.com/support |
| Marketing URL | https://christlinksocial.com |
| Copyright | 2026 Christ Link Social |

## Version 1.0 page

**Promotional text (170):**
Find worship nights, Bible studies and retreats near you, see which friends are going, and pray together with your church community.

**Description:**
Christ Link Social helps you find your people and grow your faith, in person.

• Discover worship nights, Bible studies, retreats, concerts and youth events near you.
• See which friends are going and invite others in a tap.
• RSVP for free events or buy tickets with Apple Pay or your card. Your QR ticket works offline at the door.
• Pray with your community on the Prayer Wall and celebrate answered prayers.
• Find your Home Church: service times, recurring gatherings and upcoming events in one place.
• Serve: sign up for volunteer shifts and keep track of the hours you've served.
• Verse of the day, share cards for Stories, and a warm, focused design in light and dark mode.

For hosts and churches: create events, sell tickets with Stripe payouts, check guests in with your camera, organise volunteers and follow your sales at a glance.

**Keywords (100):** `church,events,worship,bible study,prayer,christian,youth group,volunteer,tickets,ministry,retreat`

**What's New:** First release.

**Screenshots:** upload `store/screenshots/iphone-6.9/iphone-6.9-1.png` … `-6.png` in order to the 6.9" display
slot (regenerate with `scripts/store/screenshots.js` after design changes).

## App Privacy (nutrition labels)

Tracking: **No** (no data is used to track people across other companies' apps or websites; no ads).

Collected and **linked to the user**, purpose **App Functionality** unless noted:

| Category → type | Why |
| --- | --- |
| Contact Info → Name, Email Address | Account and sign-in codes |
| User Content → Photos or Videos | Profile photo, banner, event images, host ID photo (also purpose: Fraud Prevention) |
| User Content → Other User Content | Posts, replies, prayers, testimonies, event chat |
| User Content → Customer Support | Emails to support |
| Financial Info → Payment Info | Card details entered in Stripe's payment form (collected by Stripe, our processor) |
| Purchases → Purchase History | Tickets and refunds |
| Identifiers → User ID | Account ID |
| Sensitive Info | Religious affiliation implied by Home Church, prayers and faith events (disclose to be safe) |

Not collected: location (used on the device for "Near me" and the map, sent only to answer that request, never
stored), contacts, browsing history, search history, health, advertising data. Crash data: **not collected while
`EXPO_PUBLIC_SENTRY_DSN` is unset** (it is unset for production today); if you add Sentry, add Diagnostics → Crash
Data and Performance Data, not linked, App Functionality.

## App Review Information

- **Sign-in required**: Yes.
  - User name: `appreview@christlinksocial.com`
  - Password: the 6-digit code in Railway → ChristLink → ChristLink-API → Variables → `REVIEW_CODE` (it never
    expires and no email is sent for this account).
- **Notes** (paste and adjust):
  > Christ Link Social uses passwordless sign-in. Tap Profile → Sign in, enter appreview@christlinksocial.com, tick
  > the Terms checkbox, tap "Send code", then enter the code given in the sign-in information above. You can browse
  > events, the community feed and church pages without signing in.
  >
  > Tickets are for in-person events (concerts, retreats, conferences) and are paid with Stripe or Apple Pay, as
  > allowed for physical services consumed outside the app. Hosts receive payouts through Stripe Connect.
  >
  > User-generated content: every post, reply, prayer, event chat message, profile, event and church has Report and
  > Block in its ••• menu; reports go to our moderation queue and are reviewed within 24 hours. Accounts can be
  > deleted in Settings → Delete account.
- **Contact**: your name, phone and email.

## Before you press Submit (things App Review will notice)

1. **Real, upcoming events in production.** Every event copied from the old site is in the past, so Discover is
   empty today. Publish a few real upcoming events (and a prayer or two on the Prayer Wall) before submitting; an
   app that opens to empty lists is a common rejection (Guideline 2.1 / 4.2).
2. **Host listing fee.** Hosts of paid events pay a listing fee by card inside the app. Apple may treat paying to
   list something *in the app* as a digital service that must use In-App Purchase (Guideline 3.1.1); ticket sales
   themselves are fine. Lowest-risk options: waive the listing fee for events created in the iOS app, or take it
   out of ticket sales instead of charging the host up front. Decide before submitting.
3. **Privacy policy and terms say "Draft — pending legal review"** at the top (`LEGAL_DRAFT_NOTICE` in
   content/legal.ts). Have them reviewed, then set the notice to an empty string.
4. **Moderation within 24 hours**: someone must watch Admin → Reports (Guideline 1.2).

## On your phone (TestFlight build)

Sign in with your email code · RSVP to a free event · buy a $1 ticket to your own test event with Apple Pay, check it
in with the scanner, refund it from Sales · report and block a test post · Prayer Wall "I prayed" · allow
notifications and receive a reminder · open https://christlinksocial.com/event/<id> from Notes or Messages: it should
open the app · Settings → Delete account on a throwaway account.
