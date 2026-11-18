/**
 * Repeating free events (docs/RECURRING.md): the words the app uses for a rule. The server works out the dates
 * (backend/src/modules/events/recurrence.ts); these must describe the same thing. Church service times
 * use lib/recurrence.ts instead.
 */
export type RepeatRule = 'weekly' | 'biweekly' | 'monthly';
export type RepeatChoice = RepeatRule | 'none';

export const REPEAT_CHOICES: RepeatChoice[] = ['none', 'weekly', 'biweekly', 'monthly'];
export const REPEAT_CHOICE_LABELS: Record<RepeatChoice, string> = {
  none: 'Doesn’t repeat',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

export const isRepeatRule = (v: unknown): v is RepeatRule => v === 'weekly' || v === 'biweekly' || v === 'monthly';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['1st', '2nd', '3rd', '4th', 'last'];

/** Which week of the month (1-4), or 5 = the last one (days 29-31), matching the server. */
export function weekOfMonth(day: number): number {
  return Math.min(Math.ceil(day / 7), 5);
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Every Tuesday at 7:00 PM", "Every other Tuesday…", "Monthly on the 2nd Tuesday…" (local time of `start`). */
export function repeatSentence(rule: RepeatRule, start: Date, withTime = true): string {
  const day = WEEKDAYS[start.getDay()];
  const at = withTime ? ` at ${timeLabel(start)}` : '';
  if (rule === 'weekly') return `Every ${day}${at}`;
  if (rule === 'biweekly') return `Every other ${day}${at}`;
  return `Monthly on the ${ORDINALS[weekOfMonth(start.getDate()) - 1]} ${day}${at}`;
}

/** Short tag for cards: "Weekly", "Every 2 weeks", "Monthly". */
export function repeatTag(rule: RepeatRule): string {
  return REPEAT_CHOICE_LABELS[rule];
}

/** The device's time zone (sent with a new series so its dates stay at the same local time). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/** A Date → "YYYY-MM-DD" on the device's calendar (the last day a series may run). */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "Until Mar 3" / "Keeps going" for the end of a series. */
export function repeatEndLabel(until: Date | string | null | undefined): string {
  if (!until) return 'No end date';
  const d = typeof until === 'string' ? new Date(until) : until;
  return `Until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
}

/**
 * A list with each repeating event shown once, at its first date in the list's order (the host's Upcoming list), and
 * how many more dates each series has in the list.
 */
export function nextOfEachSeries<T extends { id: string; series_id?: string | null }>(events: T[]): { events: T[]; more: Map<string, number> } {
  const seen = new Set<string>();
  const more = new Map<string, number>();
  const out: T[] = [];
  for (const e of events) {
    const sid = e.series_id;
    if (!sid) {
      out.push(e);
      continue;
    }
    if (seen.has(sid)) {
      more.set(sid, (more.get(sid) ?? 0) + 1);
      continue;
    }
    seen.add(sid);
    out.push(e);
  }
  return { events: out, more };
}
