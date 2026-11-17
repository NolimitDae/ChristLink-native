import type { RepostInput, RepostPreview } from './api';
import type { Event } from './types';

/** The "Share an event" form (app/event/repost.tsx): text as typed, dates as Date. */
export interface RepostDraft {
  link: string;
  name: string;
  organizer_name: string;
  start: Date | null;
  end: Date | null;
  format: 'in_person' | 'online' | 'hybrid';
  venue_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  online_url: string;
  event_type: string;
  description: string;
  cover_url: string;
  source_url: string;
  ticket_url: string;
}

export const emptyRepostDraft: RepostDraft = {
  link: '', name: '', organizer_name: '', start: null, end: null, format: 'in_person', venue_name: '', address: '', city: '', state: '',
  zip: '', online_url: '', event_type: '', description: '', cover_url: '', source_url: '', ticket_url: '',
};

const toDate = (v?: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** Fills the form from what a listing link or a flyer gave. Only what it provided is changed; the rest stays as typed. */
export function applyPreview(draft: RepostDraft, p: Partial<RepostPreview>): RepostDraft {
  const next: RepostDraft = { ...draft };
  const text: (keyof RepostPreview & keyof RepostDraft)[] = ['name', 'organizer_name', 'venue_name', 'address', 'city', 'state', 'zip', 'online_url', 'event_type', 'description', 'cover_url', 'source_url', 'ticket_url'];
  for (const k of text) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) (next[k] as string) = v;
  }
  if (p.format) next.format = p.format;
  next.start = toDate(p.start_date) ?? draft.start;
  next.end = toDate(p.end_date) ?? draft.end;
  if (next.start && next.end && next.end.getTime() <= next.start.getTime()) next.end = null;
  return next;
}

export function draftFromRepost(e: Event): RepostDraft {
  return {
    ...emptyRepostDraft,
    name: e.name,
    organizer_name: e.organizer_name ?? '',
    start: toDate(e.start_date),
    end: toDate(e.end_date),
    format: e.format,
    venue_name: e.venue_name ?? '',
    address: e.address ?? '',
    city: e.city ?? '',
    state: e.state ?? '',
    zip: e.zip ?? '',
    online_url: e.online_url ?? '',
    event_type: e.event_type ?? '',
    description: e.description ?? '',
    cover_url: e.cover_url ?? '',
    source_url: e.source_url ?? '',
    ticket_url: e.ticket_url ?? '',
  };
}

/** A typed link, tidied: adds https:// when missing. Null when it isn't a web link. */
export function tidyLink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s/?#.]+\.[^\s/?#]+[^\s]*$/i.test(withScheme) ? withScheme : null;
}

export type RepostErrors = Partial<Record<'name' | 'organizer_name' | 'start' | 'end' | 'city' | 'online_url' | 'source_url' | 'ticket_url', string>>;

/** The same rules the server applies (backend reposts.service.ts), so mistakes show before sending. */
export function validateRepost(d: RepostDraft, opts: { editing?: boolean; now?: number } = {}): RepostErrors {
  const now = opts.now ?? Date.now();
  const e: RepostErrors = {};
  if (d.name.trim().length < 3) e.name = 'Add the event’s name';
  if (!d.organizer_name.trim()) e.organizer_name = 'Add who is hosting it';
  if (!d.start) e.start = 'Choose when it starts';
  else if (!opts.editing && d.start.getTime() < now - 86_400_000) e.start = 'That date has already passed';
  if (d.start && d.end && d.end.getTime() <= d.start.getTime()) e.end = 'The end must be after the start';
  if (d.format !== 'online' && !d.city.trim()) e.city = 'Add the city';
  for (const k of ['online_url', 'source_url', 'ticket_url'] as const) {
    if (tidyLink(d[k]) === null) e[k] = 'That doesn’t look like a link';
  }
  return e;
}

/** Form → request body. Empty text becomes null so an edit can clear a field. */
export function repostPayload(d: RepostDraft): RepostInput {
  const opt = (s: string) => s.trim() || null;
  const online = d.format !== 'in_person';
  const inPerson = d.format !== 'online';
  return {
    name: d.name.trim(),
    organizer_name: d.organizer_name.trim(),
    start_date: (d.start as Date).toISOString(),
    end_date: d.end ? d.end.toISOString() : null,
    format: d.format,
    description: opt(d.description),
    event_type: opt(d.event_type),
    venue_name: inPerson ? opt(d.venue_name) : null,
    address: inPerson ? opt(d.address) : null,
    city: inPerson ? opt(d.city) : null,
    state: inPerson ? opt(d.state) : null,
    zip: inPerson ? opt(d.zip) : null,
    online_url: online ? tidyLink(d.online_url) || null : null,
    cover_url: opt(d.cover_url),
    source_url: tidyLink(d.source_url) || null,
    ticket_url: tidyLink(d.ticket_url) || null,
  };
}
