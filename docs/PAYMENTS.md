# How money moves — Christ Link Social

This describes the native app and the Railway API it calls (`server.js` in ChristLink1). Stay in **Stripe test
mode** (`pk_test_…` in `.env.local`, `sk_test_…` in Railway) until Phase 5.

## The numbers

| Item | Who pays | Amount | Where it's computed |
|---|---|---|---|
| Ticket face value | Attendee | Set by host per ticket type | `ticket_types.price_cents` |
| Service fee | Attendee | 7% of face value (after discounts), rounded to the cent | server `/api/price-breakdown`, mirrored in `lib/fees.ts` |
| Card processing | Host by default ("absorb"), or attendee | 2.9% + 30¢ of the charge | same |
| Sales tax estimate | Attendee | From `/api/tax-estimate` (shown only when > $0) | server |
| Listing fee | Host | $19.99 per paid event, promo codes can reduce it to $0 | `/api/charge-listing-fee`, `/api/validate-listing-promo` |

Worked example (verified against production on 2026-10-15): one $15.00 ticket, host absorbs processing →
attendee pays **$15.00 + $1.05 service fee = $16.05** (+ tax if any); Stripe takes $0.77; host receives **$14.23**.
If the attendee covers processing, the charge is grossed up to $16.84 and the host receives $15.00.
`__tests__/lib/fees.test.ts` pins these values; if the server formula changes, those tests fail.

## Buying a ticket (native)

1. Event page → **Get tickets** opens the checkout sheet (`components/event/CheckoutSheet.tsx`).
2. The sheet shows an instant estimate from `computeBreakdown()`, then replaces it with the server's
   `/api/price-breakdown` and `/api/tax-estimate`. Each line (tickets, discount, service fee, tax, total) is separate.
3. Coupon codes: `POST /api/events/:id/validate-coupon` → `{ label, newTotal }`.
4. **Pay** → `POST /api/create-payment-intent { eventId, ticketTypeId, qty, buyerEmail, couponCode }` →
   `{ clientSecret, ticketCode }` or `{ free: true }` when a coupon brings the total to $0.
   This request is **never retried automatically** (`lib/api.ts`), so a flaky network can't double-charge.
5. Stripe PaymentSheet collects card / Apple Pay / Google Pay. Card data goes straight to Stripe.
6. On success the app calls `POST /api/tickets/confirm-by-intent { paymentIntentId }` (the
   **confirm-by-intent fallback**, so the ticket appears immediately instead of waiting for the webhook), then the
   ticket shows in the Tickets tab. The Stripe webhook remains the source of truth and also confirms the ticket.
7. Declined card / 3-D Secure failure: PaymentSheet shows Stripe's message; the sheet stays open; nothing is charged.

## Refunds

- Attendee: Ticket → **Request refund** → `POST /api/tickets/:id/request-refund { reason }`. Refunds are at the
  host's discretion.
- Host: Sales screen → **Approve / Deny** (`POST /api/refund-requests/:id/approve|deny`) or refund any confirmed
  ticket directly (`POST /api/tickets/:id/refund`). A refunded ticket's status becomes `refunded`; it no longer
  scans as valid.
- Refund after payout: Stripe debits the host's connected account balance (it can go negative and is recovered from
  future payouts). The Sales screen shows refunds as a separate line and **net payout excludes refunded tickets**
  (`summarizeSales`, tested).

## Host payouts (Stripe Connect, embedded)

- Hosts never leave Christ Link. Host → Payouts → **Set up payouts** opens Stripe's embedded onboarding form
  (`components/host/StripeConnect.tsx` on phones via `@stripe/stripe-react-native`, `StripeConnect.web.tsx` on the
  website via Connect.js). Both get a client secret from `POST /api/connect/account-session`.
- Accounts are created on first use with **no Stripe dashboard** (`controller.stripe_dashboard.type = none`), so
  there is no Stripe sign-in step. Per the Connect platform profile (confirmed 2026-11-14) Christ Link is liable for
  refunds, chargebacks and negative balances on host accounts and is responsible for requirement collection
  (`losses.payments = application`, `requirement_collection = application`); the embedded onboarding and notification
  banner collect what Stripe needs. Our platform pays Stripe's Connect fees (`fees.payer = application`). Ticket charges are destination charges on the platform account (statement name
  `CHRISTLINK`).
- After onboarding the app calls `POST /api/connect-sync`; Stripe's `account.updated` webhook keeps
  `host_stripe_accounts` current too.
- **View payouts** shows Stripe's embedded payouts component: balance, history, schedule and bank account. On the
  website, Stripe's notification banner appears when Stripe needs more details.
- Fallback: Expo Go (its native Stripe module has no Connect views) and app builds from before 2026-11-13 use
  `POST /api/connect-onboard` (Stripe-hosted page).
- Paid events require: identity verified (Host → Verify) **and** payouts enabled.

## Listing a paid event

Create event → Review → $19.99 listing fee with optional promo code → the card is tokenized on device
(`createPaymentMethod`) → `POST /api/charge-listing-fee { paymentMethodId, eventId, hostEmail, promoCode }` →
then publish (`PATCH /api/events/:id/publish`) or schedule (`PATCH /api/events/:id/schedule`).

## Tests

| Test | File |
|---|---|
| Fee math and rounding matches production (5 live cases, half-cent rounding, discounts, $0) | `__tests__/lib/fees.test.ts` |
| Payment intent is never retried; declined-card message surfaces | `__tests__/lib/api.test.ts` |
| Every payment route's method, path and body | `__tests__/lib/api-contract.test.ts` |
| 3 sales + 1 refund summary; refund after payout | `__tests__/lib/fees.test.ts` |

Server-side tests the plan asks for (duplicate webhook delivery is idempotent via `webhook_events`, refund after
payout via Stripe test clocks) belong in the ChristLink1 repo — see the developer-review list in `docs/REVIEW.md`.

## Known server issues found while building

- `GET /api/price-breakdown?price=0` returns `stripeFee: 30, hostReceives: -30`. Free tickets should return zeros.
  The native app uses its own zero-safe math for display.
- `/api/tickets/:id/wallet` (Apple Wallet pass) requires an Authorization header and returns a `.pkpass` blob,
  which the native app can't open without a short-lived signed download URL. Add
  `GET /api/tickets/:id/wallet-link` that returns a 5-minute signed URL, then wire the button.
