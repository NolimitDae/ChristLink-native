import { createEventSchema } from '../../lib/validation';
import { parseDollarsToCents } from '../../lib/fees';
import { deviceTimeZone, isRepeatRule, localDay, type RepeatChoice } from '../../lib/eventRepeat';
import type { CreateEventPayload, Event, EventFormat, TicketType } from '../../lib/types';

export interface TicketDraft {
  key: string;
  name: string;
  price: string;
  quantity: string;
}

export interface EventDraft {
  event_type: string;
  name: string;
  description: string;
  age_group: string;
  cover_url: string | null;
  gallery_urls: string[];
  forum_enabled: boolean;
  start: Date | null;
  end: Date | null;
  format: EventFormat;
  venue_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  online_url: string;
  max_capacity: string;
  schedule: boolean;
  publish_at: Date | null;
  is_paid: boolean;
  absorb: boolean;
  tickets: TicketDraft[];
  /** Repeating free event (docs/RECURRING.md). Set while creating; fixed once the first date is published. */
  repeat: RepeatChoice;
  /** Last day it may happen; null = keeps going (the server stops after a year). */
  repeat_until: Date | null;
}

export type DraftErrors = Partial<Record<string, string>>;

export const STEPS = ['Basics', 'When & where', 'Tickets', 'Review'] as const;

let keySeq = 0;
export function newTicket(name = ''): TicketDraft {
  keySeq += 1;
  return { key: `t${Date.now()}-${keySeq}`, name, price: '', quantity: '' };
}

export function emptyDraft(): EventDraft {
  return {
    event_type: 'Worship',
    name: '',
    description: '',
    age_group: 'All Ages',
    cover_url: null,
    gallery_urls: [],
    forum_enabled: true,
    start: null,
    end: null,
    format: 'in_person',
    venue_name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    online_url: '',
    max_capacity: '',
    schedule: false,
    publish_at: null,
    is_paid: false,
    absorb: true,
    tickets: [newTicket('General admission')],
    repeat: 'none',
    repeat_until: null,
  };
}

const toDate = (iso?: string | null) => (iso ? new Date(iso) : null);

export function draftFromEvent(e: Event): EventDraft {
  return {
    event_type: e.event_type ?? 'Worship',
    name: e.name ?? '',
    description: e.description ?? '',
    age_group: e.age_group ?? 'All Ages',
    cover_url: e.cover_url ?? null,
    gallery_urls: e.gallery_urls ?? [],
    forum_enabled: e.forum_enabled ?? true,
    start: toDate(e.start_date),
    end: toDate(e.end_date),
    format: e.format ?? 'in_person',
    venue_name: e.venue_name ?? '',
    address: e.address ?? '',
    city: e.city ?? '',
    state: e.state ?? '',
    zip: e.zip ?? '',
    online_url: e.online_url ?? '',
    max_capacity: e.max_capacity ? String(e.max_capacity) : '',
    schedule: !!e.publish_at && e.status === 'draft',
    publish_at: toDate(e.publish_at),
    is_paid: e.is_paid,
    absorb: e.absorb_stripe_fee ?? true,
    tickets: [],
    repeat: isRepeatRule(e.series?.rule) ? e.series.rule : isRepeatRule(e.repeat_rule) ? e.repeat_rule : 'none',
    repeat_until: toDate(e.series?.until),
  };
}

/** The repeat part of a save: only for a new event or a first date that is still a draft (the rule is fixed after). */
export function repeatPayload(d: EventDraft, existing?: Pick<Event, 'status' | 'series_id' | 'series_index'> | null): CreateEventPayload['repeat'] {
  const canSet = !existing || (existing.status === 'draft' && (existing.series_index ?? 0) === 0);
  if (!canSet) return undefined;
  if (d.repeat === 'none' || d.is_paid) return existing?.series_id ? null : undefined;
  return { rule: d.repeat, timezone: deviceTimeZone(), until: d.repeat_until ? localDay(d.repeat_until) : null };
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);
const inPerson = (f: EventFormat) => f === 'in_person' || f === 'hybrid';
const online = (f: EventFormat) => f === 'online' || f === 'hybrid';

export function draftToPayload(d: EventDraft): CreateEventPayload {
  const cap = parseInt(d.max_capacity, 10);
  return {
    name: d.name.trim(),
    description: opt(d.description),
    event_type: d.event_type,
    age_group: d.age_group,
    format: d.format,
    is_paid: d.is_paid,
    absorb_stripe_fee: d.is_paid ? d.absorb : undefined,
    start_date: d.start?.toISOString(),
    end_date: d.end?.toISOString(),
    venue_name: inPerson(d.format) ? opt(d.venue_name) : undefined,
    address: inPerson(d.format) ? opt(d.address) : undefined,
    city: inPerson(d.format) ? opt(d.city) : undefined,
    state: inPerson(d.format) ? opt(d.state) : undefined,
    zip: inPerson(d.format) ? opt(d.zip) : undefined,
    online_url: online(d.format) ? opt(d.online_url) : undefined,
    max_capacity: Number.isFinite(cap) && cap > 0 ? cap : undefined,
    forum_enabled: d.forum_enabled,
    cover_url: d.cover_url ?? undefined,
    gallery_urls: d.gallery_urls,
    publish_at: d.schedule && d.publish_at ? d.publish_at.toISOString() : undefined,
  };
}

export function ticketCents(tk: TicketDraft): number | null {
  return parseDollarsToCents(tk.price);
}

/** A throwaway Event so the real EventCard can render the live preview. */
export function draftToPreviewEvent(d: EventDraft, hostId: string, hostName: string, existing?: TicketType[]): Event {
  const now = new Date().toISOString();
  const ticketTypes: TicketType[] =
    existing && existing.length > 0
      ? existing
      : d.tickets
          .map(tk => ({ tk, cents: ticketCents(tk) }))
          .filter(x => x.cents !== null && (x.cents ?? 0) > 0)
          .map(x => ({ id: x.tk.key, event_id: 'preview', name: x.tk.name || 'Ticket', price_cents: x.cents ?? 0, created_at: now, tickets_sold: 0 }));
  return {
    id: 'preview',
    host_id: hostId,
    host_name: hostName,
    name: d.name.trim() || 'Your event name',
    description: d.description,
    event_type: d.event_type,
    age_group: d.age_group,
    format: d.format,
    is_paid: d.is_paid,
    absorb_stripe_fee: d.absorb,
    start_date: d.start?.toISOString(),
    end_date: d.end?.toISOString(),
    venue_name: opt(d.venue_name),
    city: opt(d.city),
    state: opt(d.state),
    online_url: opt(d.online_url),
    cover_url: d.cover_url ?? undefined,
    gallery_urls: d.gallery_urls,
    forum_enabled: d.forum_enabled,
    status: 'draft',
    created_at: now,
    going_count: 0,
    ticket_types: ticketTypes,
  };
}

function zodErrors(d: EventDraft): DraftErrors {
  const p = draftToPayload(d);
  const res = createEventSchema.safeParse({
    ...p,
    start_date: p.start_date ?? '',
    online_url: p.online_url ?? '',
  });
  const out: DraftErrors = {};
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!out[key]) out[key] = issue.message;
    }
  }
  return out;
}

const STEP_FIELDS: Record<number, string[]> = {
  0: ['name', 'description', 'event_type', 'age_group'],
  1: ['start_date', 'end_date', 'publish_at', 'venue_name', 'address', 'city', 'state', 'zip', 'online_url', 'max_capacity', 'format', 'repeat_until'],
  2: ['tickets'],
};

export function validateDraft(d: EventDraft, opts: { editing: boolean; now?: number } = { editing: false }): DraftErrors {
  const now = opts.now ?? Date.now();
  const errs: DraftErrors = zodErrors(d);
  if (errs.start_date) errs.start_date = 'Choose when your event starts';
  if (!d.start) errs.start_date = 'Choose when your event starts';
  else if (!opts.editing && d.start.getTime() <= now) errs.start_date = 'Start time must be in the future';
  if (d.end && d.start && d.end.getTime() <= d.start.getTime()) errs.end_date = 'End must be after the start';
  if (d.max_capacity.trim()) {
    const cap = Number(d.max_capacity);
    if (!Number.isInteger(cap) || cap <= 0) errs.max_capacity = 'Enter a whole number, or leave blank';
  }
  if (d.schedule) {
    if (!d.publish_at) errs.publish_at = 'Choose when to publish';
    else if (d.publish_at.getTime() <= now) errs.publish_at = 'Publish time must be in the future';
    else if (d.start && d.publish_at.getTime() >= d.start.getTime()) errs.publish_at = 'Publish before the event starts';
  }
  if (d.repeat !== 'none') {
    if (d.is_paid) errs.tickets = 'Repeating events are free to attend. Make it a one-time event to sell tickets.';
    if (d.repeat_until && d.start) {
      const lastDay = new Date(d.repeat_until);
      lastDay.setHours(23, 59, 59, 999);
      if (lastDay.getTime() < d.start.getTime()) errs.repeat_until = 'The last date must be on or after the first';
      else if (lastDay.getTime() > d.start.getTime() + 366 * 86_400_000) errs.repeat_until = 'A repeating event can run for up to a year';
    }
  }
  if (d.is_paid && !opts.editing) {
    if (d.tickets.length === 0) errs.tickets = 'Add at least one ticket type';
    d.tickets.forEach(tk => {
      const cents = ticketCents(tk);
      if (!tk.name.trim()) errs[`ticket_name_${tk.key}`] = 'Name this ticket';
      if (cents === null) errs[`ticket_price_${tk.key}`] = 'Enter a price like 15 or 15.50';
      else if (cents < 100) errs[`ticket_price_${tk.key}`] = 'Paid tickets start at $1.00';
      if (tk.quantity.trim()) {
        const q = Number(tk.quantity);
        if (!Number.isInteger(q) || q <= 0) errs[`ticket_qty_${tk.key}`] = 'Whole number, or blank for unlimited';
      }
    });
  }
  return errs;
}

export function errorsForStep(errs: DraftErrors, step: number): DraftErrors {
  if (step >= 3) return errs;
  const fields = STEP_FIELDS[step] ?? [];
  const out: DraftErrors = {};
  for (const [k, v] of Object.entries(errs)) {
    if (fields.includes(k) || (step === 2 && k.startsWith('ticket_'))) out[k] = v;
  }
  return out;
}

export function firstErrorStep(errs: DraftErrors): number | null {
  for (let i = 0; i < 3; i++) if (Object.keys(errorsForStep(errs, i)).length > 0) return i;
  return null;
}

export interface StepProps {
  draft: EventDraft;
  update: (patch: Partial<EventDraft>) => void;
  errors: DraftErrors;
  editing: boolean;
}
