# Repeating events

Hosts can make a **free** event repeat: weekly, every 2 weeks, or monthly on the same weekday ("2nd Tuesday", or
"last Friday" when the first date is the 29th–31st). It can end on a chosen day or keep going (up to a year).

## How it's stored
- `event_series` (one row per repeating event): `rule`, the host's `timezone` (from the device), `anchor_start` (the
  first date's start), `duration_minutes`, `until` (end of the last allowed day in that zone), `ended_at`.
- Every date is an ordinary `events` row with `series_id` + `series_index` (0 = the first date). Because each date is
  its own event, RSVPs, the waitlist, reminders, check-in, "I'm going" and the forum all work per date unchanged.
- A unique index on `(series_id, series_index)` means two workers can't add the same date twice.

## When dates are created
- The host creates the first date like any event, with **Repeats** on the When & where step. Nothing else exists
  while it's a draft (the rule can still be changed or removed).
- Publishing the first date (or its scheduled publish) adds every date up to **90 days ahead**
  (`backend/src/modules/events/series.ts` `topUpSeries`). The worker job `event-series` runs hourly (:25) and adds
  the next dates as time passes, until `until`, a year after the first date, or the series is ended.
- New dates copy the details of the latest date (name, description, place, cover, capacity, forum on/off).
- Dates are computed on the host's wall clock (`recurrence.ts`), so "7 pm" stays 7 pm across daylight saving.

## What people see
- Discover, Events and search list a repeating event **once, at its next date**, with "Free · Weekly" on the card.
- The event page has a **Repeats** card ("Every Tuesday at 7:00 PM · No end date") and chips for the next dates;
  each opens that date. The host's Upcoming list shows it once with "Weekly · 12 more dates".

## Changing and stopping it
- Editing a date of a live series asks **This date only** or **This and later dates**. The second applies the same
  changes to every later date (`PATCH /api/events/:id` with `apply_to: 'series'`); a new time moves them all to that
  time of day, and dates added later follow it too. Earlier dates are never changed.
- Event menu (host): **Cancel this date** (others stay) and **Cancel this and later dates**
  (`DELETE /api/events/:id?scope=following`: cancels them and stops new dates). A cancelled date is never re-added.
- Repeating events can't be ticketed (`POST /api/ticket-types` refuses them) and the rule can't be changed once the
  first date is published.
