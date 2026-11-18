/**
 * Repeating events (docs/RECURRING.md): the dates of a series, worked out on the host's wall clock so "every Tuesday at
 * 7 pm" stays 7 pm across daylight-saving changes. No date library: Intl gives the zone's offset at any instant.
 */
export const REPEAT_RULES = ['weekly', 'biweekly', 'monthly'] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];

export const isRepeatRule = (v: unknown): v is RepeatRule => typeof v === 'string' && (REPEAT_RULES as readonly string[]).includes(v);

/** How far ahead a series' dates exist at any time; the hourly job adds more as time passes. */
export const HORIZON_DAYS = 90;
/** A series ends at most this long after its first date. */
export const MAX_SERIES_DAYS = 366;
/** Never create more than this many dates in one go (a weekly series over 90 days is 13). */
export const MAX_PER_RUN = 30;

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface Wall {
  y: number;
  m: number; // 0-11
  d: number;
  h: number;
  min: number;
  weekday: number; // 0 = Sunday
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The wall-clock time in `tz` at `at`. */
export function wallTime(at: Date, tz: string): Wall {
  const parts = fmt(tz).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    y: Number(get('year')),
    m: Number(get('month')) - 1,
    d: Number(get('day')),
    h: Number(get('hour')) % 24,
    min: Number(get('minute')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  };
}

/** Milliseconds the zone is ahead of UTC at `at` (e.g. New York in summer: -4 h). */
function offsetAt(at: Date, tz: string): number {
  const w = wallTime(at, tz);
  const sec = Number(fmt(tz).formatToParts(at).find((p) => p.type === 'second')?.value ?? 0);
  return Date.UTC(w.y, w.m, w.d, w.h, w.min, sec) - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock time happens in `tz`. Month/day may overflow (Date.UTC normalises them). A time that happens
 * twice (fall back) gives the first; one that doesn't exist (spring forward) moves forward by the gap, as calendars do.
 */
export function fromWallTime(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const wall = Date.UTC(y, m, d, h, min);
  const a = wall - offsetAt(new Date(wall), tz);
  const b = wall - offsetAt(new Date(a), tz);
  const matches = (t: number) => {
    const w = wallTime(new Date(t), tz);
    return Date.UTC(w.y, w.m, w.d, w.h, w.min) === wall;
  };
  const okA = matches(a);
  const okB = matches(b);
  if (okA && okB) return new Date(Math.min(a, b));
  if (okA) return new Date(a);
  if (okB) return new Date(b);
  return new Date(Math.max(a, b));
}

/** Which week of the month a day falls in (1-4), or 5 for the last such weekday ("last Friday"). */
export function weekOfMonth(day: number): number {
  return Math.min(Math.ceil(day / 7), 5);
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** The day of the month of the nth `weekday` (n = 5 means the last one). */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const first = 1 + ((weekday - firstWeekday + 7) % 7);
  if (n < 5) return first + (n - 1) * 7;
  let day = first + 21;
  while (day + 7 <= daysInMonth(y, m)) day += 7;
  return day;
}

/**
 * The start of date number `index` (0 = the first) of a series that began at `anchor`. Weekly and every-two-weeks keep
 * the weekday and time; monthly keeps "the 2nd Tuesday" (or "the last Friday" when the first date was the 29th-31st).
 */
export function occurrenceStart(anchor: Date, rule: RepeatRule, index: number, tz: string): Date {
  const w = wallTime(anchor, tz);
  if (rule === 'weekly' || rule === 'biweekly') {
    const step = rule === 'weekly' ? 7 : 14;
    return fromWallTime(w.y, w.m, w.d + index * step, w.h, w.min, tz);
  }
  // Days 1-28 keep their week ("4th Tuesday"); 29-31 can only be the last one of the month
  const n = weekOfMonth(w.d);
  const monthIndex = w.m + index;
  const y = w.y + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return fromWallTime(y, m, nthWeekday(y, m, w.weekday, n), w.h, w.min, tz);
}

/**
 * Indexes and start times of a series' dates after `afterIndex`, up to `horizon` (and `until`, the last day it may
 * happen, end of that day in the zone), at most `max`.
 */
export function nextOccurrences(
  anchor: Date,
  rule: RepeatRule,
  tz: string,
  afterIndex: number,
  horizon: Date,
  until: Date | null,
  max = MAX_PER_RUN,
): { index: number; start: Date }[] {
  const lastAllowed = Math.min(horizon.getTime(), until ? until.getTime() : Infinity, anchor.getTime() + MAX_SERIES_DAYS * 86_400_000);
  const out: { index: number; start: Date }[] = [];
  for (let i = afterIndex + 1; out.length < max; i++) {
    const start = occurrenceStart(anchor, rule, i, tz);
    if (start.getTime() > lastAllowed) break;
    out.push({ index: i, start });
  }
  return out;
}

/** "YYYY-MM-DD" in the host's zone → the last instant of that day there. */
export function endOfLocalDay(date: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return new Date(fromWallTime(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, 0, 0, tz).getTime() - 1);
}
