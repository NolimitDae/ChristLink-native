/**
 * Gentle verse-of-the-day habit, kept on the device: the days the person opened the verse, a run of days in a row,
 * and this week's dots. Nothing resets loudly; a missed day just starts a new run.
 */
const KEEP_DAYS = 60;

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shift(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Adds today (once) and keeps the newest days only. */
export function recordDay(days: string[], today = new Date()): string[] {
  const key = dayKey(today);
  if (days.includes(key)) return days;
  return [...days, key].sort().slice(-KEEP_DAYS);
}

/** Days in a row ending today (or yesterday, so the run still shows before today's visit is recorded). */
export function currentStreak(days: string[], today = new Date()): number {
  const set = new Set(days);
  let cursor = set.has(dayKey(today)) ? today : shift(today, -1);
  let n = 0;
  while (set.has(dayKey(cursor))) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

/** Sunday-to-Saturday flags for the current week. */
export function weekDots(days: string[], today = new Date()): { key: string; label: string; done: boolean; isToday: boolean }[] {
  const set = new Set(days);
  const sunday = shift(today, -today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = shift(sunday, i);
    const key = dayKey(d);
    return { key, label: 'SMTWTFS'[i], done: set.has(key), isToday: key === dayKey(today) };
  });
}

export function streakLabel(streak: number, weekCount: number): string {
  if (weekCount === 7) return 'Perfect week';
  if (streak >= 2) return `${streak} days in a row`;
  return weekCount > 1 ? `${weekCount} days this week` : 'Day 1 · new verse tomorrow';
}
