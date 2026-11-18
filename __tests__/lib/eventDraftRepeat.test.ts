import { draftFromEvent, emptyDraft, repeatPayload, validateDraft, type EventDraft } from '../../components/host/eventDraft';
import type { Event } from '../../lib/types';

const NOW = new Date(2026, 10, 18, 12, 0).getTime();
const draft = (patch: Partial<EventDraft>): EventDraft => ({
  ...emptyDraft(),
  name: 'Tuesday Prayer',
  format: 'online',
  online_url: 'https://meet.example.com/x',
  start: new Date(2026, 10, 24, 19, 0),
  end: new Date(2026, 10, 24, 20, 30),
  ...patch,
});

describe('repeating events in the create form', () => {
  it('sends the rule for a new event, with the last day on the device calendar', () => {
    const p = repeatPayload(draft({ repeat: 'weekly', repeat_until: new Date(2027, 1, 23, 0, 0) }), null);
    expect(p).toMatchObject({ rule: 'weekly', until: '2027-02-23' });
    expect(typeof p?.timezone).toBe('string');
    expect(repeatPayload(draft({ repeat: 'monthly' }), null)).toMatchObject({ rule: 'monthly', until: null });
    expect(repeatPayload(draft({ repeat: 'none' }), null)).toBeUndefined();
  });

  it('can change or remove the rule only while the first date is a draft', () => {
    const firstDraft = { status: 'draft' as const, series_id: 's1', series_index: 0 };
    expect(repeatPayload(draft({ repeat: 'biweekly' }), firstDraft)).toMatchObject({ rule: 'biweekly' });
    expect(repeatPayload(draft({ repeat: 'none' }), firstDraft)).toBeNull();
    expect(repeatPayload(draft({ repeat: 'weekly' }), { status: 'published', series_id: 's1', series_index: 0 })).toBeUndefined();
    expect(repeatPayload(draft({ repeat: 'weekly' }), { status: 'published', series_id: 's1', series_index: 3 })).toBeUndefined();
  });

  it('keeps repeating events free and checks the end date', () => {
    expect(validateDraft(draft({ repeat: 'weekly', is_paid: true }), { editing: false, now: NOW }).tickets).toMatch(/free/);
    expect(validateDraft(draft({ repeat: 'weekly', repeat_until: new Date(2026, 10, 20) }), { editing: false, now: NOW }).repeat_until).toMatch(/on or after/);
    expect(validateDraft(draft({ repeat: 'weekly', repeat_until: new Date(2028, 0, 1) }), { editing: false, now: NOW }).repeat_until).toMatch(/up to a year/);
    expect(validateDraft(draft({ repeat: 'weekly', repeat_until: new Date(2026, 10, 24) }), { editing: false, now: NOW }).repeat_until).toBeUndefined();
  });

  it('reads the rule back when editing', () => {
    const ev = {
      id: 'e1', host_id: 'h', name: 'x', is_paid: false, format: 'online', status: 'draft', created_at: '', going_count: 0, ticket_types: [],
      series_id: 's1', series_index: 0, repeat_rule: 'weekly',
      series: { id: 's1', rule: 'biweekly', timezone: 'America/New_York', until: '2027-01-31T04:59:59.999Z', ended: false, dates: [] },
    } as unknown as Event;
    const d = draftFromEvent(ev);
    expect(d.repeat).toBe('biweekly');
    expect(d.repeat_until?.toISOString()).toBe('2027-01-31T04:59:59.999Z');
    expect(draftFromEvent({ ...ev, series: null, repeat_rule: null }).repeat).toBe('none');
  });
});
