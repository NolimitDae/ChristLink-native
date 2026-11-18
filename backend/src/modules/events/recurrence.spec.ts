import { endOfLocalDay, fromWallTime, isTimeZone, nextOccurrences, occurrenceStart, wallTime } from './recurrence';

const NY = 'America/New_York';
const local = (d: Date, tz = NY) => {
  const w = wallTime(d, tz);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${w.y}-${p(w.m + 1)}-${p(w.d)} ${p(w.h)}:${p(w.min)} ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.weekday]}`;
};

describe('recurrence: wall-clock math', () => {
  it('converts wall time to an instant and back, either side of daylight saving', () => {
    expect(fromWallTime(2026, 6, 14, 19, 0, NY).toISOString()).toBe('2026-07-14T23:00:00.000Z'); // EDT
    expect(fromWallTime(2026, 11, 15, 19, 0, NY).toISOString()).toBe('2026-12-16T00:00:00.000Z'); // EST
    expect(local(new Date('2026-12-16T00:00:00Z'))).toBe('2026-12-15 19:00 Tue');
  });

  it('handles the skipped and repeated hours', () => {
    // 2027-03-14 02:30 doesn't exist in New York: moves forward to 03:30 EDT
    expect(local(fromWallTime(2027, 2, 14, 2, 30, NY))).toBe('2027-03-14 03:30 Sun');
    // 2026-11-01 01:30 happens twice: the first (EDT)
    expect(fromWallTime(2026, 10, 1, 1, 30, NY).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('validates time zones', () => {
    expect(isTimeZone('America/Chicago')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
    expect(isTimeZone('')).toBe(false);
    expect(isTimeZone(5)).toBe(false);
  });
});

describe('recurrence: dates of a series', () => {
  // Tuesday 2026-10-27 7:00 pm New York (EDT); clocks go back on 2026-11-01
  const anchor = fromWallTime(2026, 9, 27, 19, 0, NY);

  it('weekly keeps the weekday and 7 pm across the clock change', () => {
    expect([0, 1, 2, 3].map((i) => local(occurrenceStart(anchor, 'weekly', i, NY)))).toEqual([
      '2026-10-27 19:00 Tue',
      '2026-11-03 19:00 Tue',
      '2026-11-10 19:00 Tue',
      '2026-11-17 19:00 Tue',
    ]);
    // the UTC hour moved with daylight saving, the local time didn't
    expect(occurrenceStart(anchor, 'weekly', 0, NY).getUTCHours()).toBe(23);
    expect(occurrenceStart(anchor, 'weekly', 1, NY).getUTCHours()).toBe(0);
  });

  it('every two weeks skips a week', () => {
    expect([1, 2].map((i) => local(occurrenceStart(anchor, 'biweekly', i, NY)))).toEqual(['2026-11-10 19:00 Tue', '2026-11-24 19:00 Tue']);
  });

  it('monthly keeps "the 2nd Tuesday" and "the last Friday"', () => {
    const second = fromWallTime(2026, 10, 10, 18, 30, NY); // Tue 10 Nov = 2nd Tuesday
    expect([1, 2, 3].map((i) => local(occurrenceStart(second, 'monthly', i, NY)))).toEqual([
      '2026-12-08 18:30 Tue',
      '2027-01-12 18:30 Tue',
      '2027-02-09 18:30 Tue',
    ]);
    const lastFriday = fromWallTime(2026, 9, 30, 20, 0, NY); // Fri 30 Oct = last Friday
    expect([1, 2, 3].map((i) => local(occurrenceStart(lastFriday, 'monthly', i, NY)))).toEqual([
      '2026-11-27 20:00 Fri',
      '2026-12-25 20:00 Fri',
      '2027-01-29 20:00 Fri',
    ]);
  });

  it('stops at the horizon, the end date and the run limit', () => {
    const horizon = new Date(anchor.getTime() + 30 * 86_400_000);
    expect(nextOccurrences(anchor, 'weekly', NY, 0, horizon, null).map((o) => o.index)).toEqual([1, 2, 3, 4]);
    const until = endOfLocalDay('2026-11-10', NY);
    expect(nextOccurrences(anchor, 'weekly', NY, 0, horizon, until).map((o) => local(o.start))).toEqual(['2026-11-03 19:00 Tue', '2026-11-10 19:00 Tue']);
    expect(nextOccurrences(anchor, 'weekly', NY, 2, horizon, null).map((o) => o.index)).toEqual([3, 4]);
    expect(nextOccurrences(anchor, 'weekly', NY, 0, new Date(anchor.getTime() + 999 * 86_400_000), null, 5)).toHaveLength(5);
  });

  it('a 4th-week date stays "4th", only the 29th-31st means "last"', () => {
    expect(local(occurrenceStart(anchor, 'monthly', 2, NY))).toBe('2026-12-22 19:00 Tue'); // 4th Tue, not the 29th
  });

  it('never runs past a year', () => {
    const far = new Date(anchor.getTime() + 900 * 86_400_000);
    const all = nextOccurrences(anchor, 'monthly', NY, 0, far, null, 100);
    expect(all.length).toBe(12);
  });

  it('reads end dates as the end of that day where the host is', () => {
    expect(endOfLocalDay('2026-11-10', NY)!.toISOString()).toBe('2026-11-11T04:59:59.999Z');
    expect(endOfLocalDay('11/10/2026', NY)).toBeNull();
  });
});
