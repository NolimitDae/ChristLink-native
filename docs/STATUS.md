# Feature status — native app (2026-10-15)

> **Update 2026-10-20:** the app no longer uses Supabase or server.js. Every "migration" / RPC / Edge Function /
> `/api/...` backend entry below is now served by the NestJS backend in `backend/` (contract: docs/BACKEND.md),
> deployed to Railway staging. The "Needs backend" rows for the wallet link, hidden RSVPs, server pushes and the
> `price=0` fee bug are done there. Still open: universal links on the website, demo reviewer account, live keys.

Done = built and wired to a real backend route or table. Partial = works with a stated gap. Needs backend = app
side is done; the server / database step is listed. "Migration" = `supabase/migrations/20261015000000_native_features.sql`
must be applied (development project first).

## What exists today (brief) and Phase 0–1

| Feature | Status | Native files | Backend |
|---|---|---|---|
| Browse & search events, categories, near me | Done | app/(tabs)/explore.tsx, components/explore/EventsTab.tsx | GET /api/events |
| Event detail, attendees, gallery, forum | Done | app/event/[id]/index.tsx, forum.tsx, components/event/* | /api/events/:id, /attendees, /forum |
| Free RSVP + cancel | Done | components/event/EventActionBar.tsx | /api/rsvp |
| Paid tickets (PaymentSheet, Apple/Google Pay, coupons, tax, 7% fee lines) | Done (test mode) | components/event/CheckoutSheet.tsx | /api/create-payment-intent, /confirm-by-intent, /price-breakdown, /tax-estimate, /validate-coupon |
| QR tickets, offline | Done | app/(tabs)/tickets.tsx, app/ticket/[id].tsx | /api/my-tickets, /api/my-rsvps |
| Apple Wallet pass | Needs backend | — | add signed `/api/tickets/:id/wallet-link` |
| Refund request / host approve / host refund | Done | app/ticket/[id].tsx, app/event/[id]/sales.tsx | /request-refund, /refund-requests, /tickets/:id/refund |
| Check-in scanner (tickets + volunteer passes) | Done | app/host/scan.tsx | /api/tickets/verify, /attendance; serve_check_in() |
| Create/edit event (4 steps, live preview, listing fee + promo, schedule) | Done | app/event/create.tsx | /api/events, /ticket-types, /charge-listing-fee, /validate-listing-promo, /publish, /schedule |
| Host dashboard, sales view with sparkline, payouts, ID verification | Done (payout history in Stripe) | app/(tabs)/host.tsx, app/event/[id]/sales.tsx, app/host/* | /sales, /connect-onboard, /connect-sync, /identity/* |
| Community feed (types, double-tap Amen, replies, share) | Done | app/(tabs)/community.tsx, components/community/* | /api/community-posts*, set_post_type() (migration) |
| Profiles (own, public, follow) | Done | app/profile.tsx, app/user/[id].tsx | /api/profile*, /api/follow |
| Notifications inbox | Done | app/notifications.tsx | /api/notifications |
| Admin (reports, verifications, church claims, verses, test push) | Done | app/admin/index.tsx | /api/admin/*, admin RPCs (migration) |
| Sentry crash reports | Done (needs DSN) | app/_layout.tsx | — |
| Security pass on new tables | Done | migration, docs/SECURITY.md | — |
| Old-table RLS policies scoped to service_role | Needs backend | — | see SECURITY.md #1 |

## Phase 2 — design and signature moments

| Feature | Status | Files |
|---|---|---|
| Design system (tokens light/dark + override, type scale, 8-pt spacing, radii, shadows, glass, motion + Reduce Motion) | Done | lib/theme.ts, contexts/ThemeContext.tsx |
| Components: buttons, chips, cards (standard/featured/ticket notches), avatar stack, badges (FREE/LIVE/Starts in), date block, bottom sheet, skeletons, empty states | Done | components/ui/* |
| /styleguide | Done | app/styleguide.tsx |
| Floating frosted tab bar, raised gold Host, sliding dot | Done | components/TabBar.tsx |
| Home: greeting + ring, verse card, Your week, Happening tonight (snap + parallax), Home Church, Pray row, categories with gold hairline | Done | app/(tabs)/index.tsx, components/home/* |
| Event cards: date block, price chip, meta, friends row, bookmark heart | Done | components/EventCard.tsx |
| Event detail: stretchy header → frosted bar, 2×2 tiles, who's going, gallery, forum preview, sticky bar | Done | app/event/[id]/index.tsx |
| Tickets: notched cards, wallet stacking, auto-brightness QR, countdown chip, memory cards | Done | app/(tabs)/tickets.tsx, app/ticket/[id].tsx |
| RSVP / purchase light burst + haptics, ticket lands in Tickets | Done | components/event/RsvpCelebration.tsx |
| Community post labels, double-tap Amen | Done | components/community/* |
| Profile banner, gold ring, verse quote card, stats row | Done | app/profile.tsx |
| Explore map (dark/parchment styles, pin-and-cross markers, clustering) | Done (Android needs Maps key) | components/explore/MapTab.tsx |
| Host stat tiles + sparklines, scanner gold frame + green flash | Done | app/(tabs)/host.tsx, app/host/scan.tsx |
| Three-step onboarding | Done | app/onboarding.tsx |
| Skeletons instead of spinners, line-art empty states | Done | throughout |

## Phase 3 — standout features

| Feature | Status | Files | Backend |
|---|---|---|---|
| Friends going (mutual follows), invite sheet, friends this week | Done | hooks/useFriendsGoing.ts, components/event/InviteSheet.tsx, components/home/FriendsWeek.tsx | migration RPCs; /api/events/:id/invite |
| Friend RSVP notification (max 1/day, same city) | Done | — | migration trigger + push-dispatch |
| Hide RSVPs from non-friends | Partial | app/settings/index.tsx | stored in user_settings; `/api/events/:id/attendees` must honor it (server) |
| Verse of the day (admin-editable, themed to next RSVP) + share cards 1080×1920 | Done | lib/features.ts, components/ShareCard.tsx | migration `verses` |
| Prayer Wall (anonymous, filters, I prayed glow + count roll + haptic, answered → testimony post + notify, report/hide) | Done | components/community/* | migration |
| Daily "N people prayed for you" | Done | — | `queue_prayer_summaries()` + pg_cron |
| Church pages, Home Church, claims + admin verification, recurring events | Done | app/church/*, components/church/* | migration |
| Serve: roles, shifts, two-tap sign-up, reminders 24h/2h, QR check-in, roster, message, complete, hours served | Done | app/serve, components/serve/*, app/host/serve.tsx | migration |

## Phase 4 — native

| Feature | Status | Notes |
|---|---|---|
| Real native app (Expo, not a web wrapper) | Done | Replaces the Median plan; no Guideline 4.2 risk |
| Push registration + per-type toggles + quiet hours | Done | app/settings/notifications.tsx, supabase/functions/push-dispatch |
| Event reminders 24h/1h | Done | local scheduled notifications |
| Server pushes for confirmations, new events, forum replies, refunds, verification | Needs backend | any row inserted into `notifications` is pushed once push-dispatch is deployed |
| Universal links / App Links | Needs web | docs/deeplinks/README.md |
| Offline screen + saved tickets offline | Done | components/OfflineBanner.tsx, tickets cache |
| Admin test push | Done | Admin → Tools (needs `eas init` project id) |

## Phase 5 — compliance and launch

| Feature | Status | Notes |
|---|---|---|
| In-app account deletion (keeps payment records) | Done | Settings → Delete account; migration changes FKs |
| Report + block everywhere, admin queue with 24 h target | Done | components/ReportSheet.tsx, app/admin |
| Terms + privacy checkbox with version recorded | Done | app/auth.tsx, `TERMS_VERSION` |
| 18+ confirmation for hosts | Done | app/event/create.tsx |
| Permission explanations | Done | app.json + in-context pre-prompts |
| Demo reviewer account | To do (you) | docs/STORE.md |
| Privacy policy, terms, host agreement, guidelines (drafts) | Done — lawyer review needed | app/legal/[doc].tsx, content/legal.ts |
| Store listings, privacy labels, data safety, launch checklist | Done | docs/STORE.md |
| Live Stripe keys, $1 live purchase + refund | To do (you, at launch) | docs/STORE.md checklist |
