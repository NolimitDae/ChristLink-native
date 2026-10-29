# Icons

Ionicons outline by default, the filled version only for an active/selected state. Concepts Ionicons can't draw
use `AppIcon` (components/icons/AppIcon.tsx), whose custom glyphs come from Phosphor (MIT) and Tabler (MIT) and
match Ionicons' outline weight. Shared components (`Button`, `IconButton`, `Chip`, `ListRow`, …) accept both.
One concept = one icon everywhere. Preview: `/styleguide` → Faith icons.

| Concept | Icon | Notes |
| --- | --- | --- |
| Prayer, "I prayed", prayer counts, Amen | `pray-outline` / `pray` | praying hands; never a raised hand or heart |
| Church, Home Church, church claims | `church-outline` / `church` | not `business-outline` (office) |
| Serve, volunteer shifts, volunteers | `serve-outline` / `serve` | hand holding a heart |
| Bible, verse of the day, Bible study | `bible-outline` | book with a cross; plain reading = `book-outline` |
| Answered prayer, testimony moment | `sparkles-outline` | |
| Events, dates | `calendar-outline` | tab bar: Events |
| Discover | `compass-outline` | tab bar |
| Tickets | `TicketIcon` (tab bar), `ticket-outline` (inline) | QR / check-in = `qr-code-outline` |
| Community, people going, friends | `people-outline` | follow / invite = `person-add-outline` |
| Profile | `person-outline` | |
| Save event | `heart-outline` / `heart` | hearts are only for saving |
| Payouts | `wallet-outline` | Stripe card payment = `lock-closed` / `card-outline` |
| Block | `ban-outline` | report = `flag-outline`, hide = `eye-off-outline` |
| Location / online | `location-outline` / `videocam-outline` | |

Profile hobbies and "open to connect" options keep the same mapping (lib/profileOptions.ts).
