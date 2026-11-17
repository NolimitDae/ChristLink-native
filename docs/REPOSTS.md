# Reposts: sharing an event from another platform

A member who isn't the organizer can share an event that's listed somewhere else (Eventbrite, a church website, a
flyer) so more people find it. It shows everywhere events do, with a **Repost** tag, who shared it, who hosts it, links
to the original listing and its tickets / RSVP page, an **I'm going** button and a discussion.

## How it's stored

A repost is an ordinary `events` row (migration `20261117000000_event_reposts`) with:

| Column | Meaning |
| --- | --- |
| `is_repost = true` | marks it; never ticketed here (`is_paid = false`, no ticket types allowed) |
| `host_id` | the member who shared it ("Shared by") |
| `organizer_name` | who actually runs it ("Hosted by") |
| `source_url` | the original listing or post |
| `ticket_url` | where tickets or the official RSVP are, when that's a different page |

Because it is an event, lists, search, the map, **I'm going** (an RSVP), the forum (`forum_enabled = true`), reports,
blocks and the admin Events screen all work without special cases. Reposts are published at once.

## API (`backend/src/modules/events/reposts.*`)

- `POST /api/reposts` creates one. Needs a name, `organizer_name`, a start that hasn't passed, and a city unless it is
  online. Links are optional but must be public web links. The same listing already shared and still upcoming → `409`
  `{ error, existingId }` (the app opens that page). A member can share `REPOSTS_PER_DAY` (5) a day.
- `PATCH /api/reposts/:id` edits it (the sharer only). `DELETE /api/events/:id` on a repost removes it outright
  (a "cancelled" label would wrongly say the organizer's event is off).
- `POST /api/reposts/preview { url }` reads a listing so the form can be filled in: schema.org Event data (JSON-LD,
  what ticketing sites publish) first, OpenGraph tags as the fallback (`link-preview.ts`). The listing's picture is
  copied to our storage. Sites that block this (Facebook) get a `422` with a message to fill the form in by hand.
- `POST /api/reposts/flyer { dataUrl }` stores a flyer as the picture and, when flyer reading is set up, reads the
  details from it.

### The link reader is locked down

The URL comes from a member, so `link-preview.ts` only fetches public `http(s)` addresses: private, loopback,
link-local and Railway-internal addresses are refused by name and again on the address actually connected to (so DNS
can't re-point a public name inward); redirects are followed at most 4 times and re-checked; 7 s timeout; 1.5 MB page
and 6 MB image caps. Text taken from pages has tags stripped; links must be `http(s)`.

### Flyer reading (optional)

`flyer-reader.ts` sends the flyer image (resized to 1568 px) to the Claude API and gets structured fields back. It is
**off until `ANTHROPIC_API_KEY` is set on the ChristLink-API service**; without it a flyer is just the picture.
`FLYER_MODEL` picks the model (default `claude-opus-5-5`, roughly a cent a flyer; `claude-haiku-5-5` is far cheaper).
Each member gets `FLYER_READS_PER_DAY` (10) reads a day. Flyer text is treated as content to transcribe, never as
instructions, and anything read is only a suggestion in a form the member checks. The privacy policy names Anthropic
for this.

## App

- `app/event/repost.tsx`: "Share an event" form (link import, flyer, fields; `?id=` edits or takes down). Rules live in
  `lib/repost.ts` and mirror the server's.
- Entry points: Events tab (footer and empty state), Discover's empty state, Host tab.
- `components/EventCard.tsx` shows the Repost tag where the price would be; `app/event/[id]/index.tsx` shows
  Shared by / Hosted by, the listing buttons and **I'm going**. The sharer edits from the ••• menu.
- Reposts don't appear in the Host tab's "My events" (no check-in, sales or volunteers apply).
