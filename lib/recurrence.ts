export type Frequency = 'weekly' | 'biweekly' | 'monthly';

export interface RecurringRule {
  frequency: Frequency;
  /** 0 = Sunday … 6 = Saturday (weekly/biweekly) */
  weekday?: number | null;
  /** 1–28 (monthly) */
  day_of_month?: number | null;
  /** "HH:MM" or "HH:MM:SS" */
  start_time: string;
  /** "YYYY-MM-DD" */
  starts_on: string;
  ends_on?: string | null;
}

const DAY_MS = 86_400_000;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function withTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0);
}

/** Upcoming occurrences (local time), starting from `from`, up to `count` results. */
export function nextOccurrences(rule: RecurringRule, from = new Date(), count = 3): Date[] {
  const out: Date[] = [];
  const start = parseLocalDate(rule.starts_on);
  const end = rule.ends_on ? withTime(parseLocalDate(rule.ends_on), '23:59') : null;

  if (rule.frequency === 'monthly') {
    const dom = rule.day_of_month ?? 1;
    let cursor = new Date(Math.max(start.getTime(), new Date(from.getFullYear(), from.getMonth(), 1).getTime()));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    for (let i = 0; i < 36 && out.length < count; i++) {
      const occ = withTime(new Date(cursor.getFullYear(), cursor.getMonth() + i, dom), rule.start_time);
      if (occ < start) continue;
      if (end && occ > end) break;
      if (occ >= from) out.push(occ);
    }
    return out;
  }

  const weekday = rule.weekday ?? 0;
  const step = rule.frequency === 'biweekly' ? 14 : 7;
  const firstOffset = (weekday - start.getDay() + 7) % 7;
  const anchor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + firstOffset);
  let n = 0;
  if (from > anchor) {
    const daysSince = Math.floor((new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime() - anchor.getTime()) / DAY_MS);
    n = Math.max(0, Math.floor(daysSince / step));
  }
  for (let guard = 0; guard < 200 && out.length < count; guard++, n++) {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n * step);
    const occ = withTime(day, rule.start_time);
    if (end && occ > end) break;
    if (occ >= from) out.push(occ);
  }
  return out;
}

export function describeRule(rule: RecurringRule): string {
  const time = withTime(new Date(2000, 0, 1), rule.start_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (rule.frequency === 'monthly') return `Monthly on the ${ordinal(rule.day_of_month ?? 1)} · ${time}`;
  const day = WEEKDAYS[rule.weekday ?? 0];
  return rule.frequency === 'biweekly' ? `Every other ${day} · ${time}` : `${day}s · ${time}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
