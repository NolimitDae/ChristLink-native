import type { Event } from './types';
import { formatCents } from './fees';

export function minTicketPrice(event: Pick<Event, 'is_paid' | 'ticket_types'>): number | null {
  if (!event.is_paid || !event.ticket_types?.length) return null;
  return Math.min(...event.ticket_types.map(t => t.price_cents));
}

export function priceLabel(event: Pick<Event, 'is_paid' | 'ticket_types'>): string {
  if (!event.is_paid) return 'Free';
  const min = minTicketPrice(event);
  if (min === null) return 'Tickets';
  const multiple = (event.ticket_types?.length ?? 0) > 1;
  return `${multiple ? 'From ' : ''}${formatCents(min)}`;
}

export function locationLabel(event: Pick<Event, 'format' | 'venue_name' | 'city' | 'state'>): string {
  if (event.format === 'online') return 'Online';
  const place = event.venue_name || event.city || 'Location TBA';
  return event.format === 'hybrid' ? `${place} · Online` : place;
}

export function isSoldOut(event: Pick<Event, 'max_capacity' | 'going_count' | 'ticket_types' | 'is_paid'>): boolean {
  if (event.is_paid && event.ticket_types.length > 0) {
    return event.ticket_types.every(tt => tt.quantity !== null && tt.quantity !== undefined && (tt.tickets_sold ?? 0) >= tt.quantity);
  }
  return !!event.max_capacity && event.going_count >= event.max_capacity;
}

export const EVENT_URL_BASE = 'https://christlinksocial.com';

export function eventShareUrl(eventId: string): string {
  return `${EVENT_URL_BASE}/event/${eventId}`;
}

/** Emoji fallback per event type when there is no cover photo. */
export function eventGlyph(event: Pick<Event, 'emoji' | 'event_type'>): string {
  if (event.emoji) return event.emoji;
  const map: Record<string, string> = {
    worship: '🎶',
    'bible study': '📖',
    retreat: '⛰️',
    youth: '🔥',
    concert: '🎤',
    prayer: '🙏',
    conference: '🎙️',
    community: '🤝',
    fellowship: '🍞',
    outreach: '💛',
  };
  return map[(event.event_type ?? '').toLowerCase()] ?? '✝️';
}
