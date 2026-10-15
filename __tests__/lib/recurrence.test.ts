import { describeRule, nextOccurrences } from '../../lib/recurrence';

const fmt = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('nextOccurrences', () => {
  it('weekly Wednesday Bible study', () => {
    // 2026-10-15 is a Thursday
    const from = new Date(2026, 9, 15, 12);
    const out = nextOccurrences({ frequency: 'weekly', weekday: 3, start_time: '19:00', starts_on: '2026-01-01' }, from, 3);
    expect(out.map(fmt)).toEqual(['2026-10-21 19:00', '2026-10-28 19:00', '2026-11-4 19:00']);
  });

  it('includes later today when the time has not passed', () => {
    const from = new Date(2026, 9, 18, 8); // Sunday 8am
    const out = nextOccurrences({ frequency: 'weekly', weekday: 0, start_time: '10:30:00', starts_on: '2026-01-04' }, from, 1);
    expect(out.map(fmt)).toEqual(['2026-10-18 10:30']);
  });

  it('biweekly keeps the anchor parity', () => {
    // anchored on Sunday 2026-10-04 → 10-18, 11-01 …
    const from = new Date(2026, 9, 10);
    const out = nextOccurrences({ frequency: 'biweekly', weekday: 0, start_time: '09:00', starts_on: '2026-10-04' }, from, 3);
    expect(out.map(fmt)).toEqual(['2026-10-18 9:00', '2026-11-1 9:00', '2026-11-15 9:00']);
  });

  it('monthly on a day of month', () => {
    const from = new Date(2026, 9, 20);
    const out = nextOccurrences({ frequency: 'monthly', day_of_month: 5, start_time: '18:00', starts_on: '2026-01-01' }, from, 2);
    expect(out.map(fmt)).toEqual(['2026-11-5 18:00', '2026-12-5 18:00']);
  });

  it('stops at ends_on and never starts before starts_on', () => {
    const from = new Date(2026, 0, 1);
    const out = nextOccurrences(
      { frequency: 'weekly', weekday: 2, start_time: '19:00', starts_on: '2026-03-01', ends_on: '2026-03-15' },
      from,
      10,
    );
    expect(out.map(fmt)).toEqual(['2026-3-3 19:00', '2026-3-10 19:00']);
  });
});

describe('describeRule', () => {
  it('reads naturally', () => {
    expect(describeRule({ frequency: 'weekly', weekday: 0, start_time: '10:30', starts_on: '2026-01-01' })).toMatch(/^Sundays · 10:30/);
    expect(describeRule({ frequency: 'biweekly', weekday: 5, start_time: '19:00', starts_on: '2026-01-01' })).toMatch(/^Every other Friday/);
    expect(describeRule({ frequency: 'monthly', day_of_month: 1, start_time: '08:00', starts_on: '2026-01-01' })).toMatch(/^Monthly on the 1st/);
    expect(describeRule({ frequency: 'monthly', day_of_month: 22, start_time: '08:00', starts_on: '2026-01-01' })).toMatch(/22nd/);
    expect(describeRule({ frequency: 'monthly', day_of_month: 13, start_time: '08:00', starts_on: '2026-01-01' })).toMatch(/13th/);
  });
});
