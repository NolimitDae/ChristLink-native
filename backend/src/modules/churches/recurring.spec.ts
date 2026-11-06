import { recurringOut, toRecurringData } from './recurring';

describe('toRecurringData', () => {
  it('converts a valid weekly row', () => {
    const d = toRecurringData({ name: ' Sunday Service ', frequency: 'weekly', weekday: 0, start_time: '10:30', starts_on: '2026-11-01' });
    expect(d.name).toBe('Sunday Service');
    expect(d.start_time.toISOString()).toBe('1970-01-01T10:30:00.000Z');
    expect(d.starts_on.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(d.ends_on).toBeUndefined();
  });

  it('enforces weekday vs day_of_month, using stored values on update', () => {
    expect(() => toRecurringData({ name: 'Prayer', frequency: 'monthly', weekday: 2, start_time: '19:00' })).toThrow('day of the month');
    expect(() => toRecurringData({ name: 'Prayer', frequency: 'weekly', start_time: '19:00' })).toThrow('weekday');
    expect(() => toRecurringData({ frequency: 'monthly' }, { frequency: 'weekly', weekday: 3, day_of_month: null })).toThrow('day of the month');
    expect(() => toRecurringData({ day_of_month: 5 }, { frequency: 'monthly', weekday: null, day_of_month: 1 })).not.toThrow();
  });

  it('rejects out-of-range values', () => {
    const base = { name: 'Group', frequency: 'weekly', weekday: 1, start_time: '19:00' };
    expect(() => toRecurringData({ ...base, start_time: '25:00' })).toThrow();
    expect(() => toRecurringData({ ...base, weekday: 7 })).toThrow();
    expect(() => toRecurringData({ ...base, duration_minutes: 5 })).toThrow();
    expect(() => toRecurringData({ ...base, name: 'x' })).toThrow();
    expect(() => toRecurringData({ name: 'Group' })).toThrow('required');
  });
});

it('recurringOut formats time and date columns like Postgres text', () => {
  const out = recurringOut({ id: 'a', start_time: new Date('1970-01-01T19:05:00Z'), starts_on: new Date('2026-10-20T00:00:00Z'), ends_on: null });
  expect(out).toEqual({ id: 'a', start_time: '19:05:00', starts_on: '2026-10-20', ends_on: null });
});
