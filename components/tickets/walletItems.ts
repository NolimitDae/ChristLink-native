import { ticketShortCode } from '../../lib/qr';
import type { RSVP, Ticket } from '../../lib/types';

export interface WalletItem {
  key: string;
  kind: 'ticket' | 'rsvp';
  id: string;
  eventId: string;
  name: string;
  start?: string;
  end?: string;
  venue?: string;
  coverUrl?: string;
  typeName?: string;
  qty: number;
  code?: string;
  status: string;
  checkedIn: boolean;
}

const TWO_HOURS = 2 * 3_600_000;

export function fromTicket(t: Ticket): WalletItem {
  return {
    key: `t-${t.id}`,
    kind: 'ticket',
    id: t.id,
    eventId: t.event_id,
    name: t.event_name ?? 'Event',
    start: t.event_start_date,
    end: t.event_end_date,
    venue: t.event_venue_name || t.event_city,
    coverUrl: t.event_cover_url,
    typeName: t.ticket_type_name ?? t.ticket_types?.name ?? 'General admission',
    qty: t.quantity,
    code: ticketShortCode(t),
    status: t.status,
    checkedIn: !!t.checked_in,
  };
}

export function fromRsvp(r: RSVP): WalletItem {
  return {
    key: `r-${r.id}`,
    kind: 'rsvp',
    id: r.id,
    eventId: r.event_id,
    name: r.event_name ?? 'Event',
    start: r.event_start_date,
    end: r.event_end_date,
    venue: r.event_venue_name || r.event_city,
    coverUrl: r.event_cover_url,
    qty: 1,
    status: r.status,
    checkedIn: false,
  };
}

/** Splits tickets + RSVPs into upcoming (soonest first) and past (most recent first). RSVPs are dropped when a ticket exists for the same event. */
export function buildWallet(tickets: Ticket[], rsvps: RSVP[], now = Date.now()): { upcoming: WalletItem[]; past: WalletItem[] } {
  const live = tickets.filter(t => t.status === 'confirmed');
  const ticketEvents = new Set(live.map(t => t.event_id));
  const items = [
    ...live.map(fromTicket),
    ...rsvps.filter(r => r.status === 'confirmed' && !ticketEvents.has(r.event_id)).map(fromRsvp),
  ];
  const endOf = (i: WalletItem) => (i.end ? new Date(i.end).getTime() : i.start ? new Date(i.start).getTime() + TWO_HOURS : Number.POSITIVE_INFINITY);
  const startOf = (i: WalletItem) => (i.start ? new Date(i.start).getTime() : Number.POSITIVE_INFINITY);
  const upcoming = items.filter(i => endOf(i) >= now).sort((a, b) => startOf(a) - startOf(b));
  const past = items.filter(i => endOf(i) < now).sort((a, b) => startOf(b) - startOf(a));
  return { upcoming, past };
}
